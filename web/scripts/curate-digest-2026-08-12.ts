/**
 * Upsert a curated 2026-08-12 digest (EN+ZH) after live feed sync lacked Chinese
 * and recycled prior-day mega-rumour lines on the WeChat card.
 */
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { createClient } from "@supabase/supabase-js";
import { loadFplXDigestFromDb } from "../lib/fpl/fpl-x-digest";

const DIGEST_DATE = "2026-08-12";

const SUMMARY_EN = `## Injuries & team news
- Arsenal: Arteta says Jurrien Timber still "weeks away"; William Saliba in rest mode and set to miss the start (post-Dortmund)
- Leeds: Gabriel Gudmundsson muscle injury ~4 weeks — may miss GW1; Justin on standby (Daniel Farke / FFScout)
- Sunderland: Nordi Mukiele injury latest; Trai Hume OOP header vs Lens week
- Brighton: Minteh fitness watch + Vuskovic bow in pre-season notes (FFScout)
- Liverpool: Should fans worry about Iraola's fitness comments? (BBC Sport)

## Transfers
- DONE: Trevoh Chalobah joins Como from Chelsea (~£30m package, 5-year deal) — BBC Sport
- DONE: Liverpool complete Ronald Araujo season loan from Barcelona (non-mandatory ~€55m buy option)
- Crystal Palace finalising Anan Khalaili from Union SG (~£21m) — David Ornstein / The Athletic
- Fulham agree Shea Charles from Southampton (~£30m package) — Fabrizio Romano
- Man Utd door closed on Aurelien Tchouameni after Real Madrid contract agreement — Fabrizio Romano
- Man Utd working on Leicester teenager Louis Page deal (Arsenal/Villa also interested) — BBC
- Crystal Palace in talks to re-sign Guessand on loan — BBC
- Liverpool–PSG still talking Barcola; fee gap remains large — Fabrizio Romano

## Community / FPL chatter
- New #FPL video drop (Let's Talk FPL)
- 2026/27 best £5.5m midfielders analysis rolling (FFScout)
`;

const SUMMARY_ZH = `## 伤病与阵容
- 阿森纳：Arteta 称 Timber 仍「数周」后复出；Saliba 休养中，开季恐缺阵（对阵多特后发布会）
- 利兹：Gudmundsson 肌肉伤约 4 周，可能缺席 GW1；Justin 待命（Farke / FFScout）
- 桑德兰：Mukiele 伤情最新；Hume OOP 头球亮相
- 布莱顿：Minteh 伤情关注 + Vuskovic 亮相（FFScout）
- 利物浦：Iraola 体能表态引发讨论（BBC Sport）

## 转会
- 官宣：查洛巴正式加盟 Como（切尔西离队，约 £30m / 五年合同）— BBC
- 官宣：阿劳霍租借加盟利物浦（买断约 €55m，非强制）已完成
- 水晶宫敲定 Anan Khalaili（约 £21m，Union SG）— Ornstein / Athletic
- 富勒姆敲定 Shea Charles（南安普敦，约 £30m 打包）— Romano
- Romano：曼联追 Tchouameni 大门已关，皇马续约谈妥
- 曼联推进莱斯特少年 Louis Page（阿森纳/维拉亦有兴趣）— BBC
- 水晶宫洽谈租回 Guessand — BBC
- Barcola：利物浦与 PSG 仍在谈，价差仍大 — Romano

## FPL 社区
- 新一期 #FPL 视频已上线（Let's Talk FPL）
- 2026/27 最佳 £5.5m 中场分析更新中（FFScout）
`;

async function main() {
  const existing = await loadFplXDigestFromDb(DIGEST_DATE);
  const now = new Date().toISOString();
  const s = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await s.from("fpl_x_digests").upsert({
    digest_date: DIGEST_DATE,
    window_start: existing?.window_start ?? `${DIGEST_DATE}T00:00:00.000Z`,
    window_end: existing?.window_end ?? now,
    summary_json: { en: SUMMARY_EN, zh: SUMMARY_ZH },
    source_items: existing?.source_items ?? [],
    source_fingerprint: `curated:${DIGEST_DATE}:${now.slice(0, 13)}`,
    model: "curated-manual",
    generated_at: now,
    updated_at: now,
  });

  if (error) throw new Error(error.message);
  console.log(`Upserted curated digest ${DIGEST_DATE}`);
  console.log(SUMMARY_ZH);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
