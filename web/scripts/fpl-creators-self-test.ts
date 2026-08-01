import assert from "node:assert/strict";
import {
  creatorKindFromFeedId,
  creatorSlugFromFeedId,
  fetchFplCreatorsItems,
} from "../lib/fpl/fpl-creators-feed";

async function main(): Promise<void> {
  assert.equal(creatorSlugFromFeedId("fpl-creator-ffscout-articles"), "ffscout");
  assert.equal(creatorKindFromFeedId("fpl-creator-lets-talk-fpl-youtube"), "youtube");

  const items = await fetchFplCreatorsItems({ limit: 20 });
  assert.ok(items.length > 0, "expected creator items from live feeds");

  const outlets = new Set(items.map((i) => i.outlet));
  assert.ok(outlets.has("Fantasy Football Scout"), "missing FFScout");
  assert.ok(
    outlets.has("Let's Talk FPL") || outlets.has("FPL Harry"),
    "missing LTFPL or FPL Harry",
  );
  assert.ok(outlets.has("Fantasy Football Hub"), "missing FF Hub");

  console.log(
    `fpl-creators-self-test: ok (${items.length} items, ${outlets.size} creators)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
