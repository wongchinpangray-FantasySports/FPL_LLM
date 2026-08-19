import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import {
  isSquadBuilderDraftV3,
  normalizeDraftV3,
  type SquadBuilderDraftV3,
} from "@/lib/squad-builder/draft";

export const dynamic = "force-dynamic";

type StoredDraft = {
  draft: SquadBuilderDraftV3;
  updated_at: string;
};

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function redisKey(userId: string): string {
  return `squad-builder:draft:v3:${userId}`;
}

async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  if (!getSupabaseAuthEnv()) {
    return {
      error: NextResponse.json({ error: "Auth not configured" }, { status: 503 }),
    };
  }
  const supa = createSupabaseServerClient();
  const { data: authData, error: authError } = await supa.auth.getUser();
  if (authError || !authData.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId: authData.user.id };
}

async function readFromPostgres(
  userId: string,
): Promise<StoredDraft | null | "missing-table"> {
  try {
    const admin = getServerSupabase();
    const { data, error } = await admin
      .from("user_squad_builder_drafts")
      .select("draft, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (/user_squad_builder_drafts|does not exist|schema cache/i.test(error.message)) {
        return "missing-table";
      }
      throw new Error(error.message);
    }
    if (!data?.draft || !isSquadBuilderDraftV3(data.draft)) return null;
    return {
      draft: normalizeDraftV3(data.draft as SquadBuilderDraftV3),
      updated_at: (data.updated_at as string) ?? new Date().toISOString(),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (/user_squad_builder_drafts|does not exist|schema cache/i.test(message)) {
      return "missing-table";
    }
    throw e;
  }
}

async function writeToPostgres(
  userId: string,
  draft: SquadBuilderDraftV3,
  updatedAt: string,
): Promise<"ok" | "missing-table"> {
  try {
    const admin = getServerSupabase();
    await admin.from("profiles").upsert(
      { id: userId, updated_at: updatedAt },
      { onConflict: "id" },
    );
    const { error } = await admin.from("user_squad_builder_drafts").upsert(
      {
        user_id: userId,
        draft,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      if (/user_squad_builder_drafts|does not exist|schema cache/i.test(error.message)) {
        return "missing-table";
      }
      throw new Error(error.message);
    }
    return "ok";
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (/user_squad_builder_drafts|does not exist|schema cache/i.test(message)) {
      return "missing-table";
    }
    throw e;
  }
}

async function readFromRedis(userId: string): Promise<StoredDraft | null> {
  const redis = redisClient();
  if (!redis) return null;
  const raw = await redis.get<StoredDraft | SquadBuilderDraftV3>(redisKey(userId));
  if (!raw) return null;
  // Support both wrapped {draft,updated_at} and bare draft payloads.
  if (isSquadBuilderDraftV3(raw)) {
    return { draft: normalizeDraftV3(raw), updated_at: new Date().toISOString() };
  }
  if (
    raw &&
    typeof raw === "object" &&
    "draft" in raw &&
    isSquadBuilderDraftV3((raw as StoredDraft).draft)
  ) {
    const wrapped = raw as StoredDraft;
    return {
      draft: normalizeDraftV3(wrapped.draft),
      updated_at: wrapped.updated_at || new Date().toISOString(),
    };
  }
  return null;
}

async function writeToRedis(
  userId: string,
  draft: SquadBuilderDraftV3,
  updatedAt: string,
): Promise<boolean> {
  const redis = redisClient();
  if (!redis) return false;
  await redis.set(redisKey(userId), { draft, updated_at: updatedAt });
  return true;
}

function pickNewer(
  a: StoredDraft | null,
  b: StoredDraft | null,
): StoredDraft | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a.updated_at) >= Date.parse(b.updated_at) ? a : b;
}

/** Load the signed-in user's Squad Builder draft from their account. */
export async function GET() {
  try {
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;

    const pg = await readFromPostgres(auth.userId);
    const fromPg = pg === "missing-table" ? null : pg;
    const fromRedis = await readFromRedis(auth.userId);
    const stored = pickNewer(fromPg, fromRedis);

    return NextResponse.json(
      {
        draft: stored?.draft ?? null,
        updated_at: stored?.updated_at ?? null,
        pending_migration: pg === "missing-table",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Save / overwrite the signed-in user's Squad Builder draft. */
export async function PUT(req: Request) {
  try {
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;

    const body = (await req.json()) as { draft?: unknown };
    if (!isSquadBuilderDraftV3(body.draft)) {
      return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
    }

    const draft = normalizeDraftV3(body.draft);
    const updatedAt = new Date().toISOString();

    const pg = await writeToPostgres(auth.userId, draft, updatedAt);
    const redisOk = await writeToRedis(auth.userId, draft, updatedAt);

    if (pg === "missing-table" && !redisOk) {
      return NextResponse.json(
        {
          error:
            "Account draft storage is unavailable. Apply migration 0029 or configure Upstash Redis.",
          pending_migration: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      updated_at: updatedAt,
      draft,
      pending_migration: pg === "missing-table",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
