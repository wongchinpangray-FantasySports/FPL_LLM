import assert from "node:assert/strict";
import {
  FOUNDER_PACK_EXPIRES_AT,
  FOUNDER_PACK_PATH,
  FOUNDER_PACK_PRICE_CNY,
  FOUNDER_PACK_PUBLIC,
  FOUNDER_PACK_THROUGH_GW,
  GW_NOTE_PRICE_CNY,
  founderPackClaimHref,
  founderPackIsLive,
  founderPackIsPublic,
  founderPackPostCta,
  wechatOutreachMessage,
} from "../lib/billing/founder-pack";

function main(): void {
  assert.equal(GW_NOTE_PRICE_CNY, 19);
  assert.equal(FOUNDER_PACK_PRICE_CNY, 49);
  assert.equal(FOUNDER_PACK_THROUGH_GW, 7);
  assert.equal(FOUNDER_PACK_PATH, "/pro");
  assert.equal(founderPackClaimHref("abc"), "/admin?grant=abc");
  assert.equal(FOUNDER_PACK_EXPIRES_AT.toISOString(), "2026-10-22T15:59:59.000Z");
  assert.equal(founderPackIsLive(new Date("2026-09-10T08:00:00.000Z")), true);
  assert.equal(founderPackIsLive(new Date("2026-10-23T00:00:00.000Z")), false);

  const envOn =
    process.env.NEXT_PUBLIC_FOUNDER_PACK_PUBLIC?.trim().toLowerCase() ===
      "true" ||
    process.env.NEXT_PUBLIC_FOUNDER_PACK_PUBLIC?.trim() === "1";
  const expectedPublic =
    envOn || process.env.NODE_ENV === "development" || FOUNDER_PACK_PUBLIC;
  assert.equal(
    founderPackIsPublic(new Date("2026-09-10T08:00:00.000Z")),
    expectedPublic,
  );
  assert.equal(founderPackIsPublic(new Date("2026-10-23T00:00:00.000Z")), false);

  const dm = wechatOutreachMessage();
  assert.match(dm, /¥19/);
  assert.match(dm, /¥49/);
  assert.match(dm, /微信号/);
  assert.match(dm, /Scout 中文继续免费/);
  assert.match(dm, /不放收款码/);
  assert.doesNotMatch(dm, /Scout Members/);

  const cta = founderPackPostCta();
  assert.match(cta, /\/pro/);
  assert.doesNotMatch(cta, /Scout Premium/);

  console.log("founder-pack-self-test: ok");
}

main();
