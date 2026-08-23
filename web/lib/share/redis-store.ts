import { Redis } from "@upstash/redis";
import { randomShareCode, isShareCode } from "@/lib/share/codes";
import type { ShareKind, ShareLink } from "@/lib/share/types";
import { isShareKind } from "@/lib/share/types";

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function pathKey(kind: ShareKind, targetPath: string): string {
  return `share:path:${kind}:${targetPath}`;
}

function codeKey(code: string): string {
  return `share:code:${code.toLowerCase()}`;
}

function viewKey(shareId: string, visitorId: string): string {
  return `share:view:${shareId}:${visitorId}`;
}

function asLink(row: Record<string, unknown> | ShareLink | null): ShareLink | null {
  if (!row) return null;
  const kind = String(row.kind ?? "");
  if (!isShareKind(kind)) return null;
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

export async function redisGetShareByCode(code: string): Promise<ShareLink | null> {
  if (!isShareCode(code)) return null;
  const r = redis();
  if (!r) return null;
  const row = await r.get<Record<string, unknown>>(codeKey(code));
  return asLink(row);
}

export async function redisUpsertShareLink(input: {
  kind: ShareKind;
  target_path: string;
  title: string;
  ref_id?: string | null;
}): Promise<ShareLink> {
  const r = redis();
  if (!r) {
    throw new Error("Share storage is not available");
  }
  const existing = asLink(
    await r.get<Record<string, unknown>>(pathKey(input.kind, input.target_path)),
  );
  if (existing) {
    const next = {
      ...existing,
      title: input.title || existing.title,
      ref_id: input.ref_id ?? existing.ref_id,
    };
    if (next.title !== existing.title || next.ref_id !== existing.ref_id) {
      await r.set(pathKey(input.kind, input.target_path), next);
      await r.set(codeKey(existing.code), next);
    }
    return next;
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomShareCode();
    const link: ShareLink = {
      id: crypto.randomUUID(),
      code,
      kind: input.kind,
      target_path: input.target_path,
      title: input.title,
      ref_id: input.ref_id ?? null,
      created_at: new Date().toISOString(),
    };
    const created = await r.set(codeKey(code), link, { nx: true });
    if (created !== "OK") continue;
    await r.set(pathKey(input.kind, input.target_path), link);
    return link;
  }
  throw new Error("Could not allocate a share code");
}

export async function redisHasShareView(
  shareId: string,
  visitorId: string,
): Promise<boolean> {
  const r = redis();
  if (!r) return false;
  return Boolean(await r.exists(viewKey(shareId, visitorId)));
}

export async function redisRecordShareView(
  shareId: string,
  visitorId: string,
): Promise<"first" | "repeat"> {
  const r = redis();
  if (!r) throw new Error("Share storage is not available");
  const created = await r.setnx(viewKey(shareId, visitorId), Date.now());
  return created ? "first" : "repeat";
}
