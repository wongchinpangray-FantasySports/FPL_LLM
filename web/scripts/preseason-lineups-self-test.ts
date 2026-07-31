import assert from "node:assert/strict";
import { parseMatchReportLineupFromUrl } from "../lib/fpl/preseason-report-lineups";

const spursMatch = {
  pl_code: "TOT",
  pl_name: "Spurs",
  opponent: "Auckland FC",
  pl_goals: 2,
  opp_goals: 0,
  date: "2026-07-26",
  pl_home: false,
  status: "finished" as const,
};

const avlMatch = {
  pl_code: "AVL",
  pl_name: "Aston Villa",
  opponent: "Porto",
  pl_goals: 1,
  opp_goals: 2,
  date: "2026-07-25",
  pl_home: false,
  status: "finished" as const,
};

const spursHtml = `
<p>Line-ups Auckland FC: Woud (Knowles 71), Sakai (c) (Prins 46). 
Spurs: Austin, Tye Hall (Russell-Denny 87), Hardy (Byrne 79), Takai (Tingey 87), 
Kyerematen (Davies 62), Donley (Fernandes 62), Gray (c) (Gallagher 62), 
Williams-Barnett (Tel 62), Moore (Yang 62), Solomon (Tyrese Hall 79), Scarlett (Richarlison 62). 
Match data Goals: Spurs - Scarlett 12, Richarlison 70.</p>`;

const spursLineup = parseMatchReportLineupFromUrl(
  spursHtml,
  "https://www.tottenhamhotspur.com/news/test",
  spursMatch,
);
assert.ok(spursLineup);
assert.equal(spursLineup!.starters.length, 11);
assert.ok(spursLineup!.starters.some((p) => p.name === "Scarlett"));
assert.ok(spursLineup!.subs.some((p) => p.name === "Richarlison" && p.minute_on === 62));


const avlHtml =
  "<p>line-up Bizot; Cash, Mings, Maatsen, Bogarde; Barkley, Bailey, Cissé, Burrowes; Hemmings, Lynch. Goals Porto 1-0 Aston Villa</p>";

const avlLineup = parseMatchReportLineupFromUrl(
  avlHtml,
  "https://readastonvilla.com/test",
  avlMatch,
);
assert.ok(avlLineup);
assert.equal(avlLineup!.starters.length, 11);
assert.ok(avlLineup!.starters.some((p) => p.name === "Lynch"));

console.log("preseason-lineups-self-test: ok");
