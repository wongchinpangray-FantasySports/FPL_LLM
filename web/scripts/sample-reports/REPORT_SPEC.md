# FALEAGUE PRO report template (canonical)

**Gold master:** Entry **916934** sample — `web/scripts/sample-reports/template.html`  
(+ canvas `gw4-note-916934.canvas.tsx` for the same outline).

Every customer delivery (A ¥19 or B ¥49) **must** follow this outline.  
Fill in their Entry / league / transfers — do **not** invent a new section order.

## Section order (fixed)

| # | Section | Required |
|---|---------|----------|
| — | Watermark · title · pills · muted intro | yes |
| — | 4 KPI stats | yes |
| — | 本周一句话 callout | yes |
| **1** | 本周动作（先看完再翻证据）— FT table + small “不要 -4” note | yes |
| | 建议首发 XI · N FT 之后（formation）— intro · XI table · bench table | yes |
| | C / VC cards (+ 备选 VC note) | yes |
| | 芯片 table（本周 / 原因；已用的芯片标出来） | yes |
| **2** | 小联赛 · {主战场名} — intro · standings · 对榜首：他们有你没有 · 你有榜首没有 · 小联赛结论 callout | yes |
| **3** | 冲击当轮小联赛冠军 · 可行性 — 3 stats · 有利/不利/结论 · 优先级 table | yes |
| **4** | 规划 4 轮内冲击小联赛冠军 — 仅 **B ¥49**（阶梯 · 加码路径 · 复盘清单 · 微信一句话） | B only |
| **N** | 证据附录 — N.1 转会 xP bars+table · N.2 建议 XI · N.3 队长候选 · （可选）模型否决 | yes |
| — | Footer（Scout 免费声明 · SKU · 修订） | yes |

- **A ¥19:** evidence is **§4** (no climb block).  
- **B ¥49:** climb is **§4**, evidence is **§5**.

## Style

Reuse CSS from `template.html` (same fonts, stats, callouts, black table headers, bars).  
Tone: Chinese, direct, one primary plan — model traps go in appendix “否决”, not in §1.

## Visual blocks (required in sample + delivery)

| Block | Where |
|-------|--------|
| Pitch XI + bench chips + C/VC cards | after §1 FT table（取代纯 XI 表作主视图；数字细节仍在证据附录） |
| 联赛阶梯 spark | §2（积分榜表保留） |
| 可行性仪表（红→橙→黄→浅绿→绿） | §3 |
| 4 轮 climb cards | §4（B only） |

## Files

| Role | Path |
|------|------|
| Public sample A/B | `web/scripts/sample-reports/template.html` + `render-sample-report-pdfs.mjs` |
| Customer delivery | `web/output/reports/gw{N}-{entry}-{a19\|b49}.{html,pdf}` |
| This spec | `web/scripts/sample-reports/REPORT_SPEC.md` |

When asked for a new customer report: copy structure from 916934 / this spec, swap data, regenerate PDF.
