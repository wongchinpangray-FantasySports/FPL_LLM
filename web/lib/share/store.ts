import { getServerSupabase } from "@/lib/supabase";
import { randomShareCode, isShareCode, managerEntryIdFromShare } from "@/lib/share/codes";
import type { ShareKind, ShareLink } from "@/lib/share/types";
import { isShareKind } from "@/lib/share/types";
import {
  redisGetShareByCode,
  redisHasShareView,
  redisRecordShareView,
  redisUpsertShareLink,
} from "@/lib/share/redis-store";
import {
  memoryGetShareByCode,
  memoryHasShareView,
  memoryRecordShareView,
  memoryUpsertShareLink,
} from "@/lib/share/memory-store";

function asLink(row: Record<string, unknown>): ShareLink {
  const raw = String(row.kind ?? "");
  const kind: ShareKind = isShareKind(raw)
    ? raw
    : managerEntryIdFromShare(
          String(row.target_path ?? ""),
          row.ref_id != null ? String(row.ref_id) : null,
        )
      ? "manager"
      : "insight";
  return {
    id: String(row.id),
    code: String(row.code),
    kind,
    target_path: String(row.target_path),
    title: String(row.title ?? ""),
    ref_id: row.ref_id != null ? String(row.ref_id) : null,
    created_at: String(row.created_at),
  };
}

function isMissingRelation(message: string): boolean {
  return /could not find the table|relation .* does not exist|schema cache/i.test(
    message,
  );
}

function isKindRejected(message: string, code?: string): boolean {
  return (
    code === "23514" ||
    /check constraint|share_links_kind|violates check/i.test(message)
  );
}

async function fallbackGetShareByCode(code: string): Promise<ShareLink | null> {
  return (await redisGetShareByCode(code)) ?? memoryGetShareByCode(code);
}

async function fallbackUpsertShareLink(input: {
  kind: ShareKind;
  target_path: string;
  title: string;
  ref_id?: string | null;
}): Promise<ShareLink> {
  try {
    return await redisUpsertShareLink(input);
  } catch (err) {
    if (err instanceof Error && /not available/i.test(err.message)) {
      return memoryUpsertShareLink(input);
    }
    throw err;
  }
}

async function fallbackHasShareView(shareId: string, visitorId: string) {
  if (await redisHasShareView(shareId, visitorId)) return true;
  return memoryHasShareView(shareId, visitorId);
}

async function fallbackRecordShareView(shareId: string, visitorId: string) {
  try {
    return await redisRecordShareView(shareId, visitorId);
  } catch (err) {
    if (err instanceof Error && /not available/i.test(err.message)) {
      return memoryRecordShareView(shareId, visitorId);
    }
    throw err;
  }
}

export async function getShareByCode(code: string): Promise<ShareLink | null> {
  if (!isShareCode(code)) return null;
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("share_links")
    .select("id,code,kind,target_path,title,ref_id,created_at")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error.message)) {
      return fallbackGetShareByCode(code);
    }
    throw new Error(error.message);
  }
  return data
    ? asLink(data as Record<string, unknown>)
    : fallbackGetShareByCode(code);
}

export async function upsertShareLink(input: {
  kind: ShareKind;
  target_path: string;
  title: string;
  ref_id?: string | null;
  created_by?: string | null;
}): Promise<ShareLink> {
  const supa = getServerSupabase();
  const { data: existing, error: findErr } = await supa
    .from("share_links")
    .select("id,code,kind,target_path,title,ref_id,created_at")
    .eq("kind", input.kind)
    .eq("target_path", input.target_path)
    .maybeSingle();
  if (findErr) {
    if (isMissingRelation(findErr.message)) {
      return fallbackUpsertShareLink(input);
    }
    throw new Error(findErr.message);
  }
  let row = existing as Record<string, unknown> | null;
  if (!row && input.kind === "manager") {
    const { data: alias } = await supa
      .from("share_links")
      .select("id,code,kind,target_path,title,ref_id,created_at")
      .eq("kind", "insight")
      .eq("target_path", input.target_path)
      .maybeSingle();
    row = (alias as Record<string, unknown> | null) ?? null;
  }
  if (row) {
    const link = asLink(row);
    if (input.title && input.title !== link.title) {
      await supa
        .from("share_links")
        .update({ title: input.title, ref_id: input.ref_id ?? link.ref_id })
        .eq("id", link.id);
      return { ...link, title: input.title, ref_id: input.ref_id ?? link.ref_id };
    }
    return link;
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomShareCode();
    const { data, error } = await supa
      .from("share_links")
      .insert({
        code,
        kind: input.kind,
        target_path: input.target_path,
        title: input.title,
        ref_id: input.ref_id ?? null,
        created_by: input.created_by ?? null,
      })
      .select("id,code,kind,target_path,title,ref_id,created_at")
      .maybeSingle();
    if (!error && data) return asLink(data as Record<string, unknown>);
    if (error && isKindRejected(error.message, error.code)) {
      // 0034's check constraint predates `manager`. Persist as `insight` so
      // the short link survives across serverless isolates until 0035 is applied.
      if (input.kind === "manager") {
        return upsertShareLink({ ...input, kind: "insight" });
      }
      return fallbackUpsertShareLink(input);
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(error.message);
    }
  }
  throw new Error("Could not allocate a share code");
}

export async function hasShareView(
  shareId: string,
  visitorId: string,
): Promise<boolean> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("share_views")
    .select("share_id")
    .eq("share_id", shareId)
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error.message)) {
      return fallbackHasShareView(shareId, visitorId);
    }
    throw new Error(error.message);
  }
  return Boolean(data);
}

export async function recordShareView(
  shareId: string,
  visitorId: string,
): Promise<"first" | "repeat"> {
  const supa = getServerSupabase();
  const { error } = await supa.from("share_views").insert({
    share_id: shareId,
    visitor_id: visitorId,
  });
  if (!error) return "first";
  if (/duplicate|unique/i.test(error.message)) return "repeat";
  if (isMissingRelation(error.message)) {
    return fallbackRecordShareView(shareId, visitorId);
  }
  throw new Error(error.message);
}
