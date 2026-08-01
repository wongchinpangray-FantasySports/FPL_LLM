import assert from "node:assert/strict";
import {
  hasDuplicateMiniPlayerIdentity,
  miniPlayerIdentityKey,
} from "../lib/mini/player-identity";
import { validateMiniSquad, validatePartialSquad } from "../lib/mini/validate";

function main(): void {
  const grossA = { fpl_id: 100, web_name: "Groß", team_id: 6 };
  const grossB = { fpl_id: 124, web_name: "Groß", team_id: 6 };

  assert.equal(
    miniPlayerIdentityKey(grossA),
    miniPlayerIdentityKey(grossB),
    "same web_name + club should share identity",
  );
  assert.notEqual(grossA.fpl_id, grossB.fpl_id);

  const dupPicks = [
    { fpl_id: 100, position: "MID", team_id: 6, web_name: "Groß" },
    { fpl_id: 124, position: "MID", team_id: 6, web_name: "Groß" },
    { fpl_id: 1, position: "GKP", team_id: 1, web_name: "Raya" },
    { fpl_id: 2, position: "DEF", team_id: 1, web_name: "Saliba" },
    { fpl_id: 3, position: "FWD", team_id: 2, web_name: "Haaland" },
  ];
  assert.ok(hasDuplicateMiniPlayerIdentity(dupPicks));
  assert.ok(
    validatePartialSquad(dupPicks).some((i) => i.code === "duplicate"),
  );
  assert.ok(validateMiniSquad(dupPicks).some((i) => i.code === "duplicate"));

  console.log("mini-validate-self-test: ok");
}

main();
