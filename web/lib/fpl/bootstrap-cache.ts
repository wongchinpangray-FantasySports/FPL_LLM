import { fplGet } from "@/lib/fpl";

export type FplBootstrapStatic = {
  elements?: Array<{
    id?: number;
    web_name?: string;
    team?: number;
    element_type?: number;
    now_cost?: number;
    status?: string;
    chance_of_playing_this_round?: number | null;
    news?: string;
  }>;
  teams?: Array<{ id?: number; short_name?: string }>;
  events?: Array<{
    id?: number;
    is_current?: boolean;
    is_next?: boolean;
    finished?: boolean;
  }>;
};

type CacheEntry = { at: number; data: FplBootstrapStatic };

const TTL_MS = 90_000;
let mem: CacheEntry | null = null;
let inflight: Promise<FplBootstrapStatic> | null = null;

async function fetchBootstrapStatic(): Promise<FplBootstrapStatic> {
  return fplGet<FplBootstrapStatic>("/bootstrap-static/", {
    timeoutMs: 20_000,
    retries: 2,
  });
}

/** One bootstrap-static payload per isolate for ~90s. Mini League hits this many times per request. */
export async function getFplBootstrapStatic(): Promise<FplBootstrapStatic> {
  if (mem && Date.now() - mem.at < TTL_MS) return mem.data;
  if (inflight) return inflight;
  inflight = fetchBootstrapStatic()
    .then((data) => {
      mem = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
