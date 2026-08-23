/**
 * Smoke-test contest decide against the live players_static + xP engine.
 *
 *   cd web && npx tsx scripts/contest-decide-self-test.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import { decideContestGw } from "../lib/contest/decide";
import { CONTEST_ALGORITHM_VERSION } from "../lib/contest/types";

const NAMES = [
  "Petrović",
  "Petrovic",
  "Virgil",
  "Richards",
  "Keane",
  "Saka",
  "Mbeumo",
  "Tavernier",
  "Buendía",
  "Buendia",
  "Haaland",
  "João Pedro",
  "Joao Pedro",
  "Calvert-Lewin",
  "E.Le Fée",
  "Le Fée",
  "Thiaw",
  "Roefs",
  "Rodon",
];

async function resolveIds(): Promise<{ fpl_id: number; web_name: string; price: number }[]> {
  const s = getServerSupabase();
  const { data, error } = await s
    .from("players_static")
    .select("fpl_id,web_name,name,base_price,position,team")
    .in("position", ["GKP", "DEF", "MID", "FWD"])
    .not("team_id", "is", null);
  if (error) throw error;

  const want = [
    { re: /^Petrovi[cć]$/i, pos: "GKP" },
    { re: /^Virgil$/i, pos: "DEF" },
    { re: /^Richards$/i, pos: "DEF" },
    { re: /^Keane$/i, pos: "DEF" },
    { re: /^Saka$/i, pos: "MID" },
    { re: /^Mbeumo$/i, pos: "MID" },
    { re: /^Tavernier$/i, pos: "MID" },
    { re: /^Buend[ií]a$/i, pos: "MID" },
    { re: /^Haaland$/i, pos: "FWD" },
    { re: /^Jo[aã]o Pedro$/i, pos: "FWD" },
    { re: /^Calvert-Lewin$/i, pos: "FWD" },
    { re: /^(E\.)?Le F[eé]e$/i, pos: "MID" },
    { re: /^Thiaw$/i, pos: "DEF" },
    { re: /^Roefs$/i, pos: "GKP" },
    { re: /^Rodon$/i, pos: "DEF" },
  ];

  const picked: { fpl_id: number; web_name: string; price: number }[] = [];
  for (const w of want) {
    const hit = (data ?? [])
      .filter((p) => p.position === w.pos)
      .filter(
        (p) =>
          w.re.test(String(p.web_name ?? "")) ||
          w.re.test(String(p.name ?? "")),
      )
      .sort((a, b) => Number(b.base_price) - Number(a.base_price))[0];
    if (!hit) {
      throw new Error(`Missing player for ${w.re} (${w.pos})`);
    }
    picked.push({
      fpl_id: hit.fpl_id as number,
      web_name: String(hit.web_name),
      price: Number(hit.base_price),
    });
  }
  return picked;
}

async function main() {
  void NAMES;
  console.log(`Contest decide self-test · ${CONTEST_ALGORITHM_VERSION}`);
  const squad = await resolveIds();
  console.log(
    "Squad:",
    squad.map((p) => `${p.web_name}#${p.fpl_id}`).join(", "),
  );

  const decision = await decideContestGw({
    gw: 1,
    bank: 0,
    freeTransfers: 0,
    chipsRemaining: ["3xc", "bboost", "wildcard", "freehit"],
    squad: squad.map((p) => ({ fpl_id: p.fpl_id, sell_price: p.price })),
    horizon: 5,
    allowHits: false,
    riskMode: "neutral",
    minCandidateMinutes: 900,
  });

  const outDir = join(process.cwd(), "output", "contest");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "decide-gw1.json"),
    JSON.stringify(decision, null, 2),
    "utf8",
  );

  console.log("\nRationale:", decision.rationale);
  console.log("Chip:", decision.chip);
  console.log(
    "Captain:",
    decision.captain?.web_name,
    "Vice:",
    decision.vice?.web_name,
  );
  console.log(
    "XI:",
    decision.startingXi.map((p) => p.web_name).join(", "),
  );
  console.log(
    "Transfers:",
    decision.transfers.length
      ? decision.transfers
          .map((t) => `${t.out_web_name}→${t.in_web_name}`)
          .join("; ")
      : "(none)",
  );
  console.log(`\nWrote ${join(outDir, "decide-gw1.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
