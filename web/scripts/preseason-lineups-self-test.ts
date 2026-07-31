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

const munMatch = {
  pl_code: "MUN",
  pl_name: "Man Utd",
  opponent: "Rosenborg",
  pl_goals: 5,
  opp_goals: 0,
  date: "2026-07-24",
  pl_home: false,
  status: "finished" as const,
};

const munHtml = `
<script>
{"teamName":"Rosenborg BK","formation":"4-3-3","starting":[{"firstName":"A","lastName":"Away","shirtNumber":1}]}
{"teamName":"Manchester United","formation":"4-2-3-1","starting":[
{"firstName":"Shea","lastName":"Lacey","shirtNumber":47},
{"firstName":"Tyrell","lastName":"Malacia","shirtNumber":12},
{"firstName":"Harry","lastName":"Maguire","shirtNumber":5},
{"firstName":"Jonny","lastName":"Evans","shirtNumber":35},
{"firstName":"Noussair","lastName":"Mazraoui","shirtNumber":3},
{"firstName":"Casemiro","lastName":"","shirtNumber":18},
{"firstName":"Kobbie","lastName":"Mainoo","shirtNumber":37},
{"firstName":"Amad","lastName":"Diallo","shirtNumber":16},
{"firstName":"Bruno","lastName":"Fernandes","shirtNumber":8},
{"firstName":"Alejandro","lastName":"Garnacho","shirtNumber":17},
{"firstName":"Joshua","lastName":"Zirkzee","shirtNumber":11}
],"substitutes":[
{"firstName":"Altay","lastName":"Bayindir","shirtNumber":1},
{"firstName":"Jacob","lastName":"Devaney","shirtNumber":52,"event":"SubOn","minute":"63'"}
]}
</script>`;

const munLineup = parseMatchReportLineupFromUrl(
  munHtml,
  "https://www.manutd.com/en/matches/mens-team/rosenborg-bk-v-manchester-united-friendly-20260724?tab=live",
  munMatch,
);
assert.ok(munLineup);
assert.equal(munLineup!.formation, "4-2-3-1");
assert.equal(munLineup!.starters.length, 11);
assert.ok(munLineup!.starters.some((p) => p.name === "Bruno Fernandes"));
assert.ok(munLineup!.subs.some((p) => p.name === "Jacob Devaney" && p.minute_on === 63));

console.log("preseason-lineups-self-test: ok");
