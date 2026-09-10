/**
 * Render sample diagnosis PDFs for /pro download buttons.
 *   node scripts/render-sample-report-pdfs.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "pro", "samples");
const template = readFileSync(join(__dirname, "sample-reports", "template.html"), "utf8");

const climbBlock = `
  <h2>4. 规划 4 轮内冲击小联赛冠军（AI League）</h2>
  <p class="muted">Package B 专属块：每轮报告会按最新排名改写剩余窗口。样张窗口 = GW4–7。</p>
  <div class="stats" style="grid-template-columns: repeat(3, 1fr);">
    <div class="stat"><b>低→中</b><span>4 轮冲榜首可行性</span></div>
    <div class="stat"><b>−57</b><span>落后榜首（243）</span></div>
    <div class="stat"><b>~+14 / 轮</b><span>追平所需平均净优势*</span></div>
  </div>
  <p class="muted small">*粗算：57÷4 ≈ 14 分/轮净胜榜首。现实中更可能先冲进前 10 / 前 5，再伺机抢榜首。</p>

  <div class="callout warn">
    <div class="t">诚实结论</div>
    57 分差距 + 榜首仍持有 Fernandes 等资产 → <strong>4 轮内夺冠偏难（低）</strong>。
    但芯片全在、本周修完死人后，<strong>4 轮内冲进前 8–10 并保持上升趋势为「中」</strong>。
    本块给出「冲冠路径」与「现实阶梯」两套规划，避免只画饼。
  </div>

  <h3>4.1 现实阶梯（建议主线）</h3>
  <table>
    <thead><tr><th>轮次</th><th>目标排名带</th><th>本周任务</th><th>芯片</th></tr></thead>
    <tbody>
      <tr>
        <td>GW4</td>
        <td>止跌 · 争前 15</td>
        <td>3 FT 修阵容；João Pedro (C) 制造差异</td>
        <td>全留</td>
      </tr>
      <tr>
        <td>GW5</td>
        <td>前 12</td>
        <td>观察 Szoboszlai / 银行；覆盖上位高频中场缺口</td>
        <td>仍留，除非空白/双赛窗口</td>
      </tr>
      <tr>
        <td>GW6</td>
        <td>前 8–10</td>
        <td>若仍落后 &gt;35：评估 FH 或定向 -4；否则稳 FT</td>
        <td>按赛程再定</td>
      </tr>
      <tr>
        <td>GW7</td>
        <td>前 5 或可视榜首</td>
        <td>芯片窗口（BB/TC/WC）择一对齐强赛程周</td>
        <td>至少动一张</td>
      </tr>
    </tbody>
  </table>

  <h3>4.2 冲冠加码路径（高风险）</h3>
  <table>
    <thead><tr><th>条件</th><th>动作</th><th>风险</th></tr></thead>
    <tbody>
      <tr>
        <td>GW4–5 你单周连续大胜榜首（累计追回 ≥25）</td>
        <td>GW6–7 才讨论 TC/BB 叠差异队长</td>
        <td>中</td>
      </tr>
      <tr>
        <td>差距仍 &gt;40 且榜首模板僵化</td>
        <td>WC 重做进攻差异轴（保留 Saka/Tavernier 类独有）</td>
        <td>高 · 芯片一次用掉</td>
      </tr>
      <tr>
        <td>默认</td>
        <td>不在 GW4 烧芯片赌一轮</td>
        <td>低（推荐）</td>
      </tr>
    </tbody>
  </table>

  <h3>4.3 每轮复盘清单（交付时会勾）</h3>
  <table>
    <thead><tr><th>#</th><th>检查项</th><th>本周样张</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>与榜首分差变化</td><td>基线 −57</td></tr>
      <tr><td>2</td><td>上位持有你没有的高拥有率资产</td><td>Fernandes / Szoboszlai</td></tr>
      <tr><td>3</td><td>你有、榜首没有的护城河</td><td>Saka / Tavernier</td></tr>
      <tr><td>4</td><td>下轮 FT / 芯片是否仍对齐阶梯</td><td>GW4：对齐「止跌」</td></tr>
    </tbody>
  </table>

  <div class="callout ok">
    <div class="t">写进买家微信的一句话</div>
    4 轮内硬抢榜首偏难；计划先用 GW4 修阵 + 队长差异止跌，GW5–7 按分差决定是否动芯片。
    每轮报告会更新「剩余窗口冲冠可行性」。
  </div>
`;

function build({ sku, skuLabel, evidenceN, climb, footer }) {
  return template
    .replaceAll("{{SKU}}", sku)
    .replaceAll("{{SKU_LABEL}}", skuLabel)
    .replaceAll("{{CLIMB_BLOCK}}", climb ? climbBlock : "")
    .replaceAll("{{EVIDENCE_N}}", String(evidenceN))
    .replaceAll("{{FOOTER}}", footer);
}

const variants = [
  {
    file: "gw4-sample-a-19.pdf",
    htmlName: "gw4-sample-a-19.html",
    html: build({
      sku: "A",
      skuLabel: "样张 · A ¥19 单轮",
      evidenceN: 4,
      climb: false,
      footer:
        "本文件为 A · 单轮 参考样张。正式交付为针对你 Entry 的 PDF，含一次修订。",
    }),
  },
  {
    file: "gw4-sample-b-49.pdf",
    htmlName: "gw4-sample-b-49.html",
    html: build({
      sku: "B",
      skuLabel: "样张 · B ¥49 · 4轮套餐",
      evidenceN: 5,
      climb: true,
      footer:
        "本文件为 B · 4轮套餐 参考样张（含「规划 4 轮内冲击小联赛冠军」）。正式交付每轮更新剩余窗口规划。",
    }),
  },
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const v of variants) {
      const htmlPath = join(outDir, v.htmlName);
      writeFileSync(htmlPath, v.html, "utf8");
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, {
        waitUntil: "load",
      });
      const pdfPath = join(outDir, v.file);
      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
      });
      await page.close();
      console.log("wrote", pdfPath);
    }
  } finally {
    await browser.close();
  }
  console.log("sample-report PDFs ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
