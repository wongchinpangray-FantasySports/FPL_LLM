import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import {
  isPlannerScenarioDraftV1,
  normalizeScenarioDraft,
  type PlannerScenarioDraftV1,
  type PlannerScenarioSlot,
} from "@/lib/planner/scenario-draft";

export const dynamic = "force-dynamic";

type StoredDraft = {
  draft: PlannerScenarioDraftV1;
  updated_at: string;
};

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function redisKey(userId: string, entryId: number): string {
  return `planner:scenario-draft:v1:${userId}:${entryId}`;
}

function parseEntryId(req: Request): number | null {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("entryId");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const emptyFallback: PlannerScenarioSlot = {
  picks: [],
  captainId: null,
  viceId: null,
  bank: 0,
};

async function readFromRedis(
  userId: string,
  entryId: number,
): Promise<StoredDraft | null> {
  const redis = redisClient();
  if (!redis) return null;
  const raw = await redis.get<StoredDraft | PlannerScenarioDraftV1>(
    redisKey(userId, entryId),
  );
  if (!raw) return null;
  if (isPlannerScenarioDraftV1(raw)) {
    return {
      draft: normalizeScenarioDraft(raw, emptyFallback),
      updated_at: new Date().toISOString(),
    };
  }
  if (
    raw &&
    typeof raw === "object" &&
    "draft" in raw &&
    isPlannerScenarioDraftV1((raw as StoredDraft).draft)
  ) {
    const wrapped = raw as StoredDraft;
    return {
      draft: normalizeScenarioDraft(wrapped.draft, emptyFallback),
      updated_at: wrapped.updated_at || new Date().toISOString(),
    };
  }
  return null;
}

async function writeToRedis(
  userId: string,
  entryId: number,
  draft: PlannerScenarioDraftV1,
  updatedAt: string,
): Promise<boolean> {
  const redis = redisClient();
  if (!redis) return false;
  await redis.set(redisKey(userId, entryId), { draft, updated_at: updatedAt });
  return true;
}

export async function GET(req: Request) {
  try {
    const entryId = parseEntryId(req);
    if (entryId == null) {
      return NextResponse.json({ error: "Invalid entryId" }, { status: 400 });
    }

    const auth = await requireFplEntryAccess(entryId);
    const stored = await readFromRedis(auth.userId, entryId);

    return NextResponse.json(
      {
        draft: stored?.draft ?? null,
        updated_at: stored?.updated_at ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof FplAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Failed to load draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const entryId = parseEntryId(req);
    if (entryId == null) {
      return NextResponse.json({ error: "Invalid entryId" }, { status: 400 });
    }

    const auth = await requireFplEntryAccess(entryId);
    const body = (await req.json()) as { draft?: unknown };
    if (!isPlannerScenarioDraftV1(body.draft)) {
      return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
    }
    if (body.draft.entryId !== entryId) {
      return NextResponse.json(
        { error: "draft.entryId must match query entryId" },
        { status: 400 },
      );
    }

    const draft = normalizeScenarioDraft(body.draft, emptyFallback);
    const updatedAt = new Date().toISOString();
    const redisOk = await writeToRedis(auth.userId, entryId, draft, updatedAt);

    if (!redisOk) {
      return NextResponse.json(
        {
          error:
            "Scenario draft storage is unavailable. Configure Upstash Redis.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      updated_at: updatedAt,
      draft,
    });
  } catch (e) {
    if (e instanceof FplAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Failed to save draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
