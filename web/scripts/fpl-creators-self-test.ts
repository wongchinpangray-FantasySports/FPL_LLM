import assert from "node:assert/strict";
import {
  FPL_CREATOR_SOURCES,
  creatorKindFromFeedId,
  creatorSlugFromFeedId,
  fetchFplCreatorsItems,
} from "../lib/fpl/fpl-creators-feed";

async function main() {
  assert.equal(FPL_CREATOR_SOURCES.length, 0, "creator sources must stay empty");
  assert.equal(creatorSlugFromFeedId("fpl-creator-ffscout-articles"), "ffscout");
  assert.equal(
    creatorKindFromFeedId("fpl-creator-lets-talk-fpl-youtube"),
    "youtube",
  );

  const items = await fetchFplCreatorsItems({ limit: 20 });
  assert.equal(items.length, 0, "creator fetch must return no items");

  console.log("fpl-creators-self-test: ok (creator syndication disabled)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
