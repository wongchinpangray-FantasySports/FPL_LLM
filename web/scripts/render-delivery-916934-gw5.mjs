/**
 * Gold-master GW5 notes for Entry 916934 (A ¥19 + B ¥49) and public /pro samples.
 *   node scripts/render-delivery-916934-gw5.mjs
 *
 * Voice/layout locked to template.html (phone-first, graphs, pitch, packs).
 */
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templateSrc = readFileSync(
  join(__dirname, "sample-reports", "template.html"),
  "utf8",
);
const styleMatch = templateSrc.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("template style not found");
const style = styleMatch[1];

const SHIRT = (code, gk = false) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}${gk ? "_1" : ""}-220.webp`;

function player({ shirt, gk = false, name, meta, xp, cap = "" }) {
  const badge =
    cap === "C"
      ? `<span class="cap">C</span>`
      : cap === "VC"
        ? `<span class="cap vc">VC</span>`
        : "";
  return `
      <div class="player">
        <div class="shirt-wrap">
          <img class="shirt" alt="" src="${SHIRT(shirt, gk)}" />
          ${badge}
        </div>
        <div class="name">${name}</div>
        <div class="meta">${meta}</div>
        <div class="xp">${xp}</div>
      </div>`;
}

function climbBlock() {
  return `
  <h2>4. 规划 4 轮内冲击小联赛冠军（AI League）</h2>
  <div class="keep">
  <p class="lede">Package B 专属块：每轮按最新排名改写剩余窗口。套餐窗口仍是 GW4–7；本份剩余 = GW5–7。</p>
  <div class="stats3">
    <div class="stat"><b>低</b><span>剩余 3 轮冲榜首可行性</span></div>
    <div class="stat"><b>−63 分</b><span>落后榜首（AI雕慢飞 325 分）</span></div>
    <div class="stat"><b>~+21 分/轮</b><span>追平所需平均净优势*</span></div>
  </div>
  <p class="note">*粗算：63÷3 = 21 分/轮净胜榜首。现实主线是冲回前 10，不是 3 轮抢冠军。</p>

  <div class="climb-rail">
    <div class="climb-steps">
      <div class="climb-step">
        <div class="gw">GW4 · 已过</div>
        <div class="tgt">修阵完成 · 分差未收</div>
        <div class="task">3 FT 清死人。76 分 · 18→16 · 分差 57 分→63 分。水晶宫后卫当零封是错的。</div>
      </div>
      <div class="climb-step now">
        <div class="gw">GW5 · 本周</div>
        <div class="tgt">止跌 · 争前 14</div>
        <div class="task">Richards → Guéhi。Haaland (C)。Mitchell 替补。卡全留。</div>
      </div>
      <div class="climb-step">
        <div class="gw">GW6</div>
        <div class="tgt">前 12</div>
        <div class="task">City–Liverpool 周。若仍落后 &gt;50 分：评估定向 −4 分；否则稳 1 FT</div>
      </div>
      <div class="climb-step">
        <div class="gw">GW7</div>
        <div class="tgt">前 8–10</div>
        <div class="task">Haaland 主场 IPS。卡择一对齐（TC 若本周没用）</div>
      </div>
    </div>
  </div>

  <div class="callout warn">
    <div class="t">诚实结论</div>
    63 分 + 只剩 3 轮 → 冲榜首可行性「低」。卡 4/4 还在，4 轮内冲进前 8–10 是「中偏低」。本周不烧卡赌一轮。
  </div>
  </div>

  <div class="keep">
  <h3>4.1 现实阶梯（建议主线）</h3>
  <div class="pack">
    <div class="row you"><div>GW5 · 本周<div><span>#1 Richards → Guéhi。Haaland 队长。Mitchell 替补。卡全留。</span></div></div><b>止跌 · 争前 14</b></div>
    <div class="row"><div>GW6<div><span>City–Liverpool 周。仍落后超过 50 分才评估定向 −4；否则稳 1 次转会。不要再买水晶宫后卫。</span></div></div><b>前 12</b></div>
    <div class="row"><div>GW7<div><span>Haaland 主场伊普斯维奇。这半程卡 4 张都在，择一对齐强赛程周。</span></div></div><b>前 8–10</b></div>
  </div>
  </div>

  <div class="keep">
  <h3>4.2 冲冠加码路径（高风险）</h3>
  <p class="lede">差 63 分还只做 1 次转会，窗口内翻盘概率低。下面是真正的加码。对应 §1 的 #4 / #5。</p>
  <div class="pack">
    <div class="row"><div>#4 · −4 分<div><span>Richards + Virgil → Guéhi + Calafiori。扣 4 分，净约 +4.5。利物浦后卫可零封，卖他换阿森纳同级零封，净赚不多。</span></div></div><b>中风险</b></div>
    <div class="row"><div>#5 · #1 之上 TC Haaland<div><span>约 +12 分。空白就把窗口最甜三队长烧了。差 63 分才考虑。</span></div></div><b>高风险</b></div>
    <div class="row no"><div>卖 Saka 追 Palmer / Isak<div><span>Saka 三轮 27.5，Palmer 只有 17.5。榜首有的贵人，你用更高的轴盖住。</span></div></div><b>否决</b></div>
    <div class="row no"><div>Calvert-Lewin → Barry<div><span>伊普斯维奇丢球多是真的；埃弗顿进攻只有联盟的 0.81 倍。数字虚。</span></div></div><b>否决</b></div>
  </div>
  <p class="note">做完 #1 之后阵容见球场。副队长保持 Saka。João Pedro 本周不当队长。</p>
  </div>

  <div class="keep">
  <div class="pack">
    <div class="row you"><div>只想止跌、不扣分、不烧卡<div><span>#1 买 Guéhi。同队便宜用 #2；锁榜首后卫用 #3。</span></div></div><b>默认</b></div>
    <div class="row"><div>认为要同时上阿森纳零封<div><span>#4。净赚有限。</span></div></div><b>可选</b></div>
    <div class="row"><div>63 分必须翻，接受烧卡<div><span>#5：#1 再三队长 Haaland。</span></div></div><b>高风险</b></div>
    <div class="row no"><div>默认继续 João Pedro 队长<div><span>上轮对。这周让给窗口最甜的 Haaland。</span></div></div><b>不要</b></div>
  </div>
  </div>

  <div class="keep">
  <h3>4.3 每轮复盘清单</h3>
  <div class="pack">
    <div class="row"><div>与榜首分差<div><span>第 3 轮基线差 57 分 → 现在差 63 分</span></div></div><b>扩了</b></div>
    <div class="row"><div>上位有、你没有<div><span>Palmer / Isak / Ødegaard / Calafiori（#3）/ Hall（不追）</span></div></div><b>先别追贵的</b></div>
    <div class="row you"><div>你有、榜首没有<div><span>Saka + Mbeumo + Calvert-Lewin</span></div></div><b>护住</b></div>
    <div class="row"><div>下轮转会 / 卡是否对齐阶梯<div><span>本周 #1 止跌。#5 才动三队长。Mitchell 替补。</span></div></div><b>GW5</b></div>
  </div>

  <div class="callout ok">
    <div class="t">写进买家微信的一句话</div>
    AI League 第 16、差 63 分。默认 Richards → Guéhi；Haaland (C)；Mitchell 替补。卡全留。不要再把水晶宫后卫当零封。
  </div>
  </div>
`;
}

function evidence(n) {
  return `
  <h2>${n}. 证据附录</h2>
  <p class="lede">下面数字支撑前半结论，不是第二套建议。</p>
  <div class="keep">
  <h3>${n}.1 转会：出 vs 入 · 未来 3 轮（对手失球 + 本队转化）</h3>
  <div class="bars">
    <div class="bar-row you"><span class="lab">Guéhi 入</span><div class="bar-track"><div class="bar-fill" style="width:51%"></div></div><span class="bar-val">17.6</span></div>
    <div class="bar-row"><span class="lab">Haaland</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">34.4</span></div>
    <div class="bar-row"><span class="lab">Saka</span><div class="bar-track"><div class="bar-fill" style="width:80%"></div></div><span class="bar-val">27.5</span></div>
    <div class="bar-row"><span class="lab">Gvardiol</span><div class="bar-track"><div class="bar-fill" style="width:42%"></div></div><span class="bar-val">14.5</span></div>
    <div class="bar-row"><span class="lab">Calafiori</span><div class="bar-track"><div class="bar-fill" style="width:41%"></div></div><span class="bar-val">14.0</span></div>
    <div class="bar-row mute"><span class="lab">Hall 不追</span><div class="bar-track"><div class="bar-fill" style="width:45%"></div></div><span class="bar-val">15.4</span></div>
    <div class="bar-row mute"><span class="lab">Richards 出</span><div class="bar-track"><div class="bar-fill" style="width:34%"></div></div><span class="bar-val">11.6</span></div>
  </div>
  <p class="note">俱乐部调整后 3 轮期望 · 第 5–7 轮。水晶宫后卫被失球期望 1.32 倍联盟压低；Guéhi / Gvardiol 吃的是曼城可零封（0.72 倍）。Hall 15.4 看着高，纽卡后卫只看防守贡献。</p>
  <details class="more">
    <summary>出 vs 入的俱乐部理由</summary>
    <div class="veto">
      <div class="row"><b>Guéhi · #1 买入</b><span>曼城主场桑德兰。失球期望只有联盟的 0.72 倍，四轮丢 2 球，可当零封。三轮 17.6。</span></div>
      <div class="row"><b>Gvardiol · #2</b><span>同队赛程更便宜，三轮少 3.1 分。</span></div>
      <div class="row"><b>Calafiori · #3</b><span>阿森纳可零封，本轮客场布莱顿没那么甜。榜首已有。</span></div>
      <div class="row"><b>Richards · #1 卖出</b><span>水晶宫失球期望是联盟的 1.32 倍，Disasi 一张红牌。不当零封。</span></div>
      <div class="row"><b>Mitchell · 替补不卖</b><span>同一条水晶宫后防。本周一次转会只换一个人。</span></div>
      <div class="row"><b>Hall · 不追</b><span>纽卡失球期望 1.23 倍联盟，后卫只看防守贡献。</span></div>
      <div class="row"><b>Palmer / Barry · 不追</b><span>你已有 Saka 27.5。Barry 埃弗顿进攻只有联盟的 0.81 倍。</span></div>
    </div>
  </details>
  </div>

  <div class="keep">
  <h3>${n}.2 建议 XI · 本轮 xP / 球队用法（支撑首发）</h3>
  <p class="note">数字已含俱乐部层。队长分 = 球员分 ×2。后卫能不能当零封，看整队失球期望和运气，不是看球员自己的分数。</p>
  <div class="bars">
    <div class="bar-row you"><span class="lab">Haaland 队长</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">11.9×2</span></div>
    <div class="bar-row you"><span class="lab">Saka 副队</span><div class="bar-track"><div class="bar-fill" style="width:82%"></div></div><span class="bar-val">9.8</span></div>
    <div class="bar-row"><span class="lab">Tavernier</span><div class="bar-track"><div class="bar-fill" style="width:74%"></div></div><span class="bar-val">8.8</span></div>
    <div class="bar-row"><span class="lab">Mbeumo</span><div class="bar-track"><div class="bar-fill" style="width:67%"></div></div><span class="bar-val">8.0</span></div>
    <div class="bar-row"><span class="lab">C.Lewin</span><div class="bar-track"><div class="bar-fill" style="width:63%"></div></div><span class="bar-val">7.5</span></div>
    <div class="bar-row"><span class="lab">Guéhi 零封</span><div class="bar-track"><div class="bar-fill" style="width:52%"></div></div><span class="bar-val">6.2</span></div>
    <div class="bar-row mute"><span class="lab">João Pedro</span><div class="bar-track"><div class="bar-fill" style="width:58%"></div></div><span class="bar-val">6.9</span></div>
  </div>
  <details class="more">
    <summary>球队整体怎么用这些人</summary>
    <div class="veto">
      <div class="row"><b>Haaland 队长</b><span>曼城进攻是联盟的 1.32 倍，主场桑德兰。</span></div>
      <div class="row"><b>Saka 副队</b><span>阿森纳在进球。客场布莱顿没零封。João Pedro 若轮换由他接管。</span></div>
      <div class="row"><b>Guéhi</b><span>曼城失球期望只有联盟的 0.72 倍，可当零封。</span></div>
      <div class="row"><b>De Cuyper</b><span>布莱顿本轮对阿森纳，只看进攻和防守贡献，不当零封。</span></div>
      <div class="row"><b>Virgil</b><span>利物浦四轮 2 次零封，客场伯恩茅斯可当零封。</span></div>
      <div class="row"><b>Mitchell / Thomas</b><span>水晶宫和考文垂都不当零封。Thomas 5.1 是防守贡献，放第三替补。</span></div>
    </div>
  </details>
  <p class="note">若仍双水晶宫首发并锁 João Pedro 当队长，等于重复第 4 轮的错：把没零封的后卫当零封，又把最甜的 Haaland 赛程让给联赛。</p>
  </div>

  <div class="keep">
  <h3>${n}.3 队长候选</h3>
  <div class="bars">
    <div class="bar-row you"><span class="lab">Haaland</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">11.9</span></div>
    <div class="bar-row you"><span class="lab">Saka</span><div class="bar-track"><div class="bar-fill" style="width:82%"></div></div><span class="bar-val">9.8</span></div>
    <div class="bar-row"><span class="lab">Tavernier</span><div class="bar-track"><div class="bar-fill" style="width:74%"></div></div><span class="bar-val">8.8</span></div>
    <div class="bar-row"><span class="lab">Mbeumo</span><div class="bar-track"><div class="bar-fill" style="width:67%"></div></div><span class="bar-val">8.0</span></div>
    <div class="bar-row"><span class="lab">C.Lewin</span><div class="bar-track"><div class="bar-fill" style="width:63%"></div></div><span class="bar-val">7.5</span></div>
    <div class="bar-row mute"><span class="lab">João Pedro</span><div class="bar-track"><div class="bar-fill" style="width:58%"></div></div><span class="bar-val">6.9</span></div>
    <div class="bar-row mute"><span class="lab">Palmer</span><div class="bar-track"><div class="bar-fill" style="width:47%"></div></div><span class="bar-val">5.6</span></div>
  </div>
  <p class="note">Haaland 比第二名 Saka 高出约 2.1 分，比 João Pedro 高出 5.0 分。本周改回模板队长。榜首锁 Palmer，你吃 Haaland 反而是差异。</p>
  </div>

  <div class="keep">
  <h3>${n}.4 本报告否决</h3>
  <div class="veto">
    <div class="row"><b>继续 João Pedro 当队长</b><span>上轮对。本轮 Haaland 打桑德兰 11.9，João Pedro 只有 6.9。</span></div>
    <div class="row"><b>双水晶宫后卫首发</b><span>失球期望是联盟的 1.32 倍，Disasi 一张红牌。Mitchell 替补，Richards 卖掉。</span></div>
    <div class="row"><b>Hall / Wissa 追榜首</b><span>纽卡进攻只有联盟的 0.72 倍；后卫只看防守贡献，不当零封。</span></div>
    <div class="row"><b>卖 Saka 买 Palmer</b><span>Saka 三轮 27.5，Palmer 17.5。护住你有、榜首没有的轴。</span></div>
    <div class="row"><b>追 Groß 上周高分 / Calvert-Lewin → Barry</b><span>布莱顿本轮对阿森纳。伊普斯维奇丢球多是真的，埃弗顿打不进去。</span></div>
    <div class="row"><b>本周三队长作为默认</b><span>窗口最甜，但差 63 分也不是一张卡能翻。默认全留；要翻才 #5。</span></div>
    <div class="row"><b>Thomas 首发压 Virgil / 卖 Le Fée</b><span>考文垂四轮零封为零。5.1 是防守贡献。第三后卫用 Virgil 时，换 Guéhi 仍多 1.7 分。</span></div>
  </div>
  </div>
`;
}

function body({ skuLabel, climb, evidenceN, watermark, footer }) {
  return `
  <p class="watermark">${watermark}</p>
  <div class="row">
    <h1>GW5 诊断 · FALEAGUE-AI FC</h1>
    <span class="pill on">${skuLabel}</span>
    <span class="pill">1 FT · 卡 4/4 全在</span>
  </div>
  <p class="lede">
    Entry 916934 · 截止 9/19 01:30 北京（英国周五 18:30）<br/>
    总分 262 · 总榜约 343.6 万 · 银行 £1.0m · 卡 4/4 未用<br/>
    主战场 AI League · 22 人 · 你第 16（上轮第 18）· 落后榜首 63 分。
  </p>

  <div class="keep">
  <div class="stats">
    <div class="stat"><b>262</b><span>总分 · 总榜约 343.6 万</span></div>
    <div class="stat"><b>#16 / 22</b><span>AI League · 落后榜首 63 分</span></div>
    <div class="stat"><b>1 FT · £1.0m</b><span>刚好够 Guéhi</span></div>
    <div class="stat"><b>卡 4/4</b><span>本周主方案全不开</span></div>
  </div>

  <div class="callout">
    <div class="t">本周一句话</div>
    默认 #1：Richards → Guéhi（不扣分、不开卡）。队长改 Haaland，Mitchell 替补。<br/>
    GW4 的 3 FT 清死人做对了；把水晶宫后卫当零封、João Pedro 继续当 C，是这周会再丢分的两件事。
  </div>
  </div>

  <h2>1. 本周动作</h2>
  <div class="keep">
  <p class="lede">
    绿卡 = 默认。所有方案都是 Haaland 当队长、Saka 当副队长；Virgil 首发，Mitchell / Thomas 替补。
  </p>
  <div class="plans">
    <div class="plan you">
      <div class="plan-n">默认 · 不开卡 · 不扣分</div>
      <div class="plan-t">Richards → Guéhi</div>
      <p>曼城主场桑德兰，可当零封。三轮 17.6。花光银行 £1.0m。Mitchell 替补。</p>
    </div>
    <div class="plan">
      <div class="plan-n">同一刀 · 更便宜</div>
      <div class="plan-t">Richards → Gvardiol</div>
      <p>同队赛程，三轮 14.5。剩 £0.3m。少 3.1 分换一点银行。</p>
    </div>
    <div class="plan">
      <div class="plan-n">锁榜首后卫</div>
      <div class="plan-t">Richards → Calafiori</div>
      <p>阿森纳可零封，三轮 14.0。本轮客场布莱顿没那么甜。</p>
    </div>
    <div class="plan no">
      <div class="plan-n">不要做</div>
      <div class="plan-t">−4 / João Pedro 队长 / 双水晶宫</div>
      <p>也不要追 Hall、Palmer、Barry。要翻 63 分才考虑 #1 再加三队长。</p>
    </div>
  </div>
  <p class="kicker">未来 3 轮后卫期望</p>
  <div class="vbars" aria-label="后卫三轮期望">
    <div class="vbar you"><div class="vbar-col" style="height:100%"></div><b>17.6</b><span>#1 Guéhi</span></div>
    <div class="vbar"><div class="vbar-col" style="height:82%"></div><b>14.5</b><span>Gvardiol</span></div>
    <div class="vbar"><div class="vbar-col" style="height:80%"></div><b>14.0</b><span>Calafiori</span></div>
    <div class="vbar mute"><div class="vbar-col" style="height:87%"></div><b>15.4</b><span>Hall 不追</span></div>
  </div>
  </div>

  <div class="keep">
  <div class="chooser">
    <div class="slot"><b>止跌</b><span>#1 Guéhi · 或 #2 Gvardiol</span></div>
    <div class="slot"><b>锁榜首后卫</b><span>#3 Calafiori</span></div>
    <div class="slot"><b>压分差</b><span>#1 已够 · #4 净赚少</span></div>
    <div class="slot"><b>必须翻</b><span>#5 = #1 + TC Haaland</span></div>
  </div>
  <p class="note">
    预期是 GW5–7 俱乐部调整后 xP（−4 分已扣）。#1 花光 £1.0m 银行。*Hall 3 轮 15.4 xP 看着高，纽卡后卫不当零封。
  </p>
  </div>

  <div class="keep">
  <h3>为什么默认不是 Gvardiol / Calafiori</h3>
  <p class="lede">三个人都能当零封资产。默认看 3 轮窗口 + 本轮谁对桑德兰，不是「阿森纳丢球更少所以买阿森纳」。</p>
  <p class="kicker">三轮期望</p>
  <div class="bars">
    <div class="bar-row you"><span class="lab">Guéhi £6.0</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">17.6</span></div>
    <div class="bar-row"><span class="lab">Gvardiol £5.7</span><div class="bar-track"><div class="bar-fill" style="width:82%"></div></div><span class="bar-val">14.5</span></div>
    <div class="bar-row"><span class="lab">Calafiori £5.8</span><div class="bar-track"><div class="bar-fill" style="width:80%"></div></div><span class="bar-val">14.0</span></div>
    <div class="bar-row mute"><span class="lab">Hall £5.2</span><div class="bar-track"><div class="bar-fill" style="width:88%"></div></div><span class="bar-val">15.4</span></div>
  </div>
  <p class="note">Guéhi 本轮主场桑德兰 6.2，Gvardiol 同场 5.1。Calafiori 客场布莱顿 4.4。Hall 15.4 看着高，纽卡失球期望是联盟的 1.23 倍，后卫只看防守贡献。银行刚好 £1.0m = Guéhi；Gvardiol 剩 0.3，Calafiori 剩 0.2。要锁榜首后卫才走 #3。</p>
  </div>

  <div class="keep">
  <h3>为什么第三后卫是 Virgil 不是 Thomas</h3>
  <p class="lede">Thomas 本轮 5.1 高于 Virgil 3.8。那是防守贡献，不是零封。考文垂零封变现已经看过：没有变现，是负的。</p>
  <div class="face">
    <div class="card">
      <h4>Virgil · 利物浦 · 首发</h4>
      <p>四轮 2 次零封。失球期望 0.89 倍联盟。客场伯恩茅斯可当零封。本轮 3.8。</p>
    </div>
    <div class="card">
      <h4>Bobby Thomas · 考文垂 · 第三替补</h4>
      <p>5.1 全是防守贡献。考文垂四轮零封为零，失球期望是联盟的 1.25 倍。不当零封。</p>
    </div>
  </div>
  <p class="note">期望零封约 0.6 次，考文垂 0 次。进攻 4.25 预期进球进 0 球。下一轮主场纽卡也是同样陷阱。</p>
  </div>

  <div class="keep">
  <h3>为什么 1 次转会换后卫，不是卖 E.Le Fée</h3>
  <p class="lede">
    Richards 本来就不上场，11.6 → 17.6 是把替补换成首发。Le Fée 会首发，要比「换进来的人 − 被换掉的首发」。
  </p>
  <p class="kicker">后卫 + 中场两位置合计 · 三轮</p>
  <div class="bars">
    <div class="bar-row you"><span class="lab">Guéhi + Le Fée</span><div class="bar-track"><div class="bar-fill" style="width:93%"></div></div><span class="bar-val">36.8</span></div>
    <div class="bar-row mute"><span class="lab">Thomas + Groß</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">39.6</span></div>
    <div class="bar-row"><span class="lab">Virgil + Groß</span><div class="bar-track"><div class="bar-fill" style="width:89%"></div></div><span class="bar-val">35.1</span></div>
    <div class="bar-row"><span class="lab">Virgil + Øde</span><div class="bar-track"><div class="bar-fill" style="width:85%"></div></div><span class="bar-val">33.6</span></div>
  </div>
  <p class="note">
    第三后卫用 Virgil（可零封）时，换 Guéhi 仍多 1.7 分。只有改上 Thomas 抢防守贡献，卖 Le Fée 才更抢分——灰色那条。默认不走：不当零封的后卫不进首发。Groß 本轮对阿森纳，还卖掉 Le Fée 下一轮主场布莱顿 7.7。
  </p>
  </div>

  <h3>建议首发 XI · #1 之后（3-4-3）</h3>

  <div class="keep">
  <p class="lede">按 #1（1 FT · Guéhi）排。#2 把 Guéhi 换成 Gvardiol；#3 换成 Calafiori。共同：Haaland (C)，Virgil 首发，Mitchell / Thomas 替补。</p>
  <p class="note">后防按整队：Guéhi（曼城可零封）· De Cuyper（布莱顿只看进攻，本轮对 ARS）· Virgil（利物浦可零封）。Thomas 的 5.1 xP 是 DefCon，COV 4 轮 0 零封，不上。</p>

  <div class="pitch" aria-label="Suggested starting XI pitch">
    <div class="xi-row">
      ${player({ shirt: 91, gk: true, name: "Petrović", meta: "vs LIV", xp: "xP 3.5" })}
    </div>
    <div class="xi-row">
      ${player({ shirt: 43, name: "Guéhi", meta: "vs SUN · 零封", xp: "xP 6.2" })}
      ${player({ shirt: 36, name: "De Cuyper", meta: "vs ARS · 进攻", xp: "xP 5.9" })}
      ${player({ shirt: 14, name: "Virgil", meta: "@ BOU · 零封", xp: "xP 3.8" })}
    </div>
    <div class="xi-row">
      ${player({ shirt: 91, name: "Tav", meta: "vs LIV", xp: "xP 8.8" })}
      ${player({ shirt: 3, name: "Saka", meta: "@ BHA", xp: "xP 9.8", cap: "VC" })}
      ${player({ shirt: 1, name: "Mbeumo", meta: "@ FUL", xp: "xP 8.0" })}
      ${player({ shirt: 56, name: "Le Fée", meta: "@ MCI", xp: "xP 5.6" })}
    </div>
    <div class="xi-row">
      ${player({ shirt: 8, name: "João Pedro", meta: "@ BRE", xp: "xP 6.9" })}
      ${player({ shirt: 43, name: "Haaland", meta: "vs SUN", xp: "xP 11.9 ×2", cap: "C" })}
      ${player({ shirt: 2, name: "C.Lewin", meta: "vs CRY", xp: "xP 7.5" })}
    </div>
  </div>
  </div>

  <div class="keep">
  <p class="kicker">板凳顺序（自动换人按 13→14→15）</p>
  <div class="bench">
    <div class="slot">
      <div class="n">12</div>
      <div class="nm">Roefs</div>
      <div class="fx">@ MCI · 只换门将</div>
    </div>
    <div class="slot">
      <div class="n">13</div>
      <div class="nm">Thomas</div>
      <div class="fx">@ NFO · 5.1 xP · 最先顶上</div>
    </div>
    <div class="slot">
      <div class="n">14</div>
      <div class="nm">Buendía</div>
      <div class="fx">@ TOT · Thomas 也不上才轮到</div>
    </div>
    <div class="slot">
      <div class="n">15</div>
      <div class="nm">Mitchell</div>
      <div class="fx">@ LEE · CRY 零封危 · 最后</div>
    </div>
  </div>
  <p class="note">
    3-4-3 下后卫几乎总能合法顶上（4-3-3 / 4-4-2）。把 Mitchell 放 13 = 中场或前锋不上，也先上水晶宫（3.8 xP）。
    Thomas 4 次首发、本轮 5.1 xP 最高，放 13；Buendía 4.0 xP 放 14；Mitchell 放 15。Roefs 对 City，只盯 Petrović。
  </p>

  <div class="grid2">
    <div class="card">
      <div class="k">C · Haaland</div>
      MCI vs SUN · FDR 2。曼城进攻 1.32×联盟，主场桑德兰是窗口最甜单人赛程。榜首锁 Palmer——你改 Haaland 才是差异。
    </div>
    <div class="card">
      <div class="k">VC · Saka</div>
      @ BHA，布莱顿 xGA 1.22×联盟零封危，阿森纳在进球。João Pedro 若轮换由他接管。开赛前确认 App 没把 C 留在 João Pedro。
    </div>
  </div>
  <p class="note">备选 C：没有。Haaland 11.9 xP vs 第二名 Saka 9.8 xP。若 App 仍指 João Pedro，开赛前改回 Haaland。</p>
  </div>

  <h3>卡：本周主方案全不开</h3>
  <div class="keep">
  <div class="chip-grid">
    <div class="card"><div class="k">Wildcard · 不开</div><p>骨架还在（Saka / Tavernier / Haaland）。留给真正的空白或结构周。</p></div>
    <div class="card"><div class="k">Bench Boost · 不开</div><p>板凳 Thomas / Buendía / Mitchell / Roefs 对曼城，4 人不够一起打。</p></div>
    <div class="card"><div class="k">Free Hit · 不开</div><p>不是空白轮。1 次转会就能换掉不当零封的后卫。</p></div>
    <div class="card"><div class="k">Triple Captain · #5 才开</div><p>Haaland 打桑德兰是窗口最甜。止跌不开；要翻 63 分就开。</p></div>
  </div>
  </div>

  <h2>2. 小联赛 · AI League（主战场）</h2>
  <div class="keep">
  <p class="lede">
    22 人。你 GW4 拿了 76 分，从第 18 升到第 16（262 分），榜首 AI雕慢飞 325 分，差 63 分。
    Benchmarked 本轮 103 分穿到第 2。本周目标是<strong>换可零封后卫 + Haaland 双倍止跌</strong>——不是再买边卫赌零封。
  </p>

  <div class="ladder" aria-label="Mini-league ladder">
    <div class="ladder-head">
      <div class="title">联赛阶梯 · 相对榜首</div>
      <div class="ladder-kpis">
        <div><b>#16</b>你的排名</div>
        <div><b>−63 分</b>落后榜首</div>
        <div><b>262 分</b>总分</div>
      </div>
    </div>
    <div class="ladder-track">
      <div class="ladder-rail">
        <div class="ladder-fill" style="width:18%"></div>
      </div>
      <div class="node" style="left: 8%">
        <div class="dot" style="background:#9aa3ab"></div>
        <div class="lab">老虎桥</div>
        <div class="sub">#18 · 255</div>
      </div>
      <div class="node you" style="left: 18%">
        <div class="dot"></div>
        <div class="lab">你</div>
        <div class="sub">#16 · 262</div>
      </div>
      <div class="node" style="left: 38%">
        <div class="dot"></div>
        <div class="lab">Whiff</div>
        <div class="sub">#10 · 276</div>
      </div>
      <div class="node" style="left: 52%">
        <div class="dot"></div>
        <div class="lab">AI尼</div>
        <div class="sub">#6 · 283</div>
      </div>
      <span class="gap-tag" style="left: 72%">差 63 分</span>
      <div class="node leader" style="left: 92%">
        <div class="dot"></div>
        <div class="lab">AI雕慢飞</div>
        <div class="sub">#1 · 325</div>
      </div>
    </div>
    <div class="ladder-legend">
      <span><i style="background:#0d6b3c"></i>你</span>
      <span><i style="background:#5a6570"></i>邻近对手</span>
      <span><i style="background:#1a1a1a"></i>榜首</span>
      <span>已掉出顶端包 · 真正要追上的是右侧 63 分</span>
    </div>
  </div>
  </div>

  <div class="keep">
  <div class="pack">
    <div class="row"><div>AI雕慢飞<div><span>325 分 · 上周 86 · 队长锁 Palmer</span></div></div><b>#1 · −63</b></div>
    <div class="row"><div>Benchmarked FC<div><span>320 · 上周 103</span></div></div><b>#2 · −58</b></div>
    <div class="row"><div>shorturl.at/sonG8<div><span>320 · 上周 77 · 上轮榜首</span></div></div><b>#2 · −58</b></div>
    <div class="row"><div>AI尼<div><span>283 · 上周 81 · 前 10 门槛</span></div></div><b>#6 · −21</b></div>
    <div class="row"><div>Whiff<div><span>276 · 上周 68</span></div></div><b>#10 · −14</b></div>
    <div class="row you"><div>FALEAGUE-AI FC（你）<div><span>262 · 上周 76 · 从第 18 升上来</span></div></div><b>#16</b></div>
    <div class="row"><div>邻近<div><span>xGPT United 267 / AI Trafford 261</span></div></div><b>±1～5</b></div>
  </div>
  </div>

  <div class="keep">
  <h3>对榜首：他们有、你没有（先别追贵的）</h3>
  <p class="lede">只作对照，不要为对齐去 −4。</p>
  <div class="pack">
    <div class="row no"><div>Palmer £9.7<div><span>榜首的队长。你有 Saka 三轮 27.5，他只有 17.5。不追。</span></div></div><b>不追</b></div>
    <div class="row no"><div>Isak £9.1<div><span>要卖 João Pedro 才买得起。三轮 22.9 vs 21.8，不值一刀。</span></div></div><b>不追</b></div>
    <div class="row no"><div>Ødegaard £6.7<div><span>阿森纳在进球。你已有 Saka，三人上限留给中场骨架。</span></div></div><b>不追</b></div>
    <div class="row no"><div>Calafiori £5.8<div><span>#3 才补。阿森纳可零封；默认 #1 买更甜的曼城打桑德兰。</span></div></div><b>#3 才补</b></div>
    <div class="row no"><div>Hall £5.2<div><span>纽卡失球期望 1.23 倍联盟，后卫只看防守贡献。</span></div></div><b>不买</b></div>
  </div>
  </div>

  <div class="keep">
  <h3>你有、榜首没有（护住）</h3>
  <div class="pack">
    <div class="row you"><div>Saka<div><span>几乎是你的独有中场。三轮 27.5。不要卖去追 Palmer。</span></div></div><b>留下</b></div>
    <div class="row you"><div>Mbeumo<div><span>曼联进攻是联盟的 1.42 倍。本轮客场富勒姆。不当队长，当骨架。</span></div></div><b>留下</b></div>
    <div class="row you"><div>Calvert-Lewin<div><span>本轮打水晶宫（丢 2.75 球/场）。三轮 19.2。</span></div></div><b>留下</b></div>
    <div class="row you"><div>Tavernier<div><span>三轮 25.9。本轮对利物浦不甜，下一轮打没零封的切尔西。</span></div></div><b>留下</b></div>
  </div>
  </div>

  <div class="callout ok">
    <div class="t">小联赛结论如何写进转会</div>
    默认看 §1 #1：1 FT · 买 Guéhi。要锁榜首后卫用 #3 Calafiori。Mitchell 继续替补。Saka 不许卖。
  </div>
  </div>

  <h2>3. 冲击当轮小联赛冠军 · 可行性</h2>
  <div class="keep">
  <p class="lede">先判断「这周有没有资格冲」，再给可选加码。主方案仍以修后防 + 止跌为准。</p>

  <div class="feas">
    <div class="feas-top">
      <div>
        <div class="gauge" aria-hidden="true">
          <svg class="gauge-svg" viewBox="0 0 112 56" xmlns="http://www.w3.org/2000/svg">
            <path d="M 10 52 A 46 46 0 0 1 18.8 25" fill="none" stroke="#e53935" stroke-width="12" stroke-linecap="butt"/>
            <path d="M 18.8 25 A 46 46 0 0 1 41.8 8.3" fill="none" stroke="#ef6c00" stroke-width="12" stroke-linecap="butt"/>
            <path d="M 41.8 8.3 A 46 46 0 0 1 70.2 8.3" fill="none" stroke="#fbc02d" stroke-width="12" stroke-linecap="butt"/>
            <path d="M 70.2 8.3 A 46 46 0 0 1 93.2 25" fill="none" stroke="#8bc34a" stroke-width="12" stroke-linecap="butt"/>
            <path d="M 93.2 25 A 46 46 0 0 1 102 52" fill="none" stroke="#2e7d32" stroke-width="12" stroke-linecap="butt"/>
            <circle cx="10" cy="52" r="6" fill="#e53935"/>
            <circle cx="102" cy="52" r="6" fill="#2e7d32"/>
          </svg>
          <div class="gauge-needle"></div>
        </div>
        <div class="gauge-scale"><span>低</span><span>中</span><span>高</span></div>
        <div class="gauge-label">低</div>
      </div>
      <div class="feas-copy">
        <div class="k">可行性：低 —— 63 分差距单周翻盘不现实，主方案仍不烧卡</div>
        <div class="feas-pills">
          <span class="hi">有利 · Haaland vs SUN</span>
          <span class="hi">有利 · 卡 4/4 还在</span>
          <span class="lo">不利 · 第 16 / 差 63 分</span>
          <span class="lo">不利 · 榜首 C 不是 Haaland</span>
          <span>杠杆 · 队长</span>
          <span>卡 · 主方案不开</span>
        </div>
      </div>
    </div>
  </div>

  <div class="stats3">
    <div class="stat"><b>低</b><span>当轮冲冠可行性</span></div>
    <div class="stat"><b>队长</b><span>最大杠杆（Haaland）</span></div>
    <div class="stat"><b>不开卡</b><span>冲奖也不动 TC（主方案）</span></div>
  </div>
  <div class="callout warn">
    <div class="t">有利 / 不利 / 结论</div>
    <p><strong>有利</strong> · Haaland 主场桑德兰 + 曼城进攻 1.32×联盟；GW4 已清死人；卡 4/4 全在；榜首锁 Palmer，你改 Haaland 是差异。</p>
    <p><strong>不利</strong> · GW4 你 76 分、榜首 86 分、Benchmarked 103 分；差距从 57 分扩到 63 分；仍在第 16。</p>
    <p><strong>结论</strong> · 本周 = 换可零封后卫 + Haaland (C) 止跌。单周不冲「当轮小联赛冠军」。</p>
  </div>
  </div>
  <div class="keep">
  <div class="pack">
    <div class="row you"><div>1 · 必做<div><span>Haaland 队长、Virgil 首发、Mitchell / Thomas 替补。水晶宫和考文垂不当零封。</span></div></div><b>所有方案</b></div>
    <div class="row you"><div>2 · 选方案<div><span>止跌 #1 / #2。锁榜首后卫 #3。必须翻 63 分才 #5 三队长。</span></div></div><b>推荐 #1</b></div>
    <div class="row no"><div>3 · 不要做<div><span>João Pedro 当队长、卖 Le Fée、追 Hall、卖 Saka、买 Barry</span></div></div><b>否决</b></div>
  </div>
  </div>

  ${climb}

  ${evidence(evidenceN)}

  <div class="foot">
    Scout 中文仍免费。这不是 Scout Members。<br/>
    ${footer}<br/>
    对手看实际失球不只看 FDR；本队看进球转化不只看 xG。§1 为推荐 × 风险 × 回报总表。−4 与 TC 都是可选手段。
  </div>
`;
}

function sampleBuyCta(sku) {
  const href = `https://www.faleague-ai.com/zh/pro?from=sample&sku=${sku}#pay`;
  return `
  <div class="sample-buyfoot">
    <div class="t">这是 Entry 916934 的报告样本，不是你的阵容</div>
    <p>GW5 截止 9/19 01:30。针对你的 Entry：A ¥9.9 本轮诊断 / B ¥39.9 用到第7轮。留微信号，发哥开通。Scout 中文继续免费。</p>
    <a href="${href}">留微信号开通</a>
  </div>
  <div class="sample-buybar" role="region" aria-label="开通 FALEAGUE PRO">
    <div>
      <b>报告样本 · 不是你的阵容</b>
      <span>GW5 截止 9/19 01:30 · A ¥9.9 / B ¥39.9</span>
    </div>
    <a class="sample-buybar-btn" href="${href}">留微信号开通</a>
  </div>`;
}

function wrapHtml({ title, htmlBody, buyBarSku }) {
  const bar = buyBarSku ? sampleBuyCta(buyBarSku) : "";
  const bodyClass = buyBarSku ? ' class="has-sample-buybar"' : "";
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <style>${style}
    .gauge-needle { transform: rotate(-62deg); }
    .gauge-label { color: #9b1c1c; }
  </style>
</head>
<body${bodyClass}>
  <!-- Structure locked to REPORT_SPEC.md. Gold master = Entry 916934 GW5. -->
  ${htmlBody}
  ${bar}
</body>
</html>`;
}

const variants = [
  {
    sku: "a",
    stem: "gw5-916934-a19",
    sampleStem: "gw5-sample-a-19",
    legacySample: "gw4-sample-a-19",
    title: "FALEAGUE PRO · GW5 · FALEAGUE-AI FC · A · ¥19",
    skuLabel: "报告样本 · A ¥19 单轮",
    evidenceN: 4,
    climb: false,
    watermark:
      "FALEAGUE PRO · 参考报告样本（Entry 916934 · AI League）· 非买家真实交付件 · 报告样本 · A ¥19 单轮",
    footer:
      "本文件为 A · 单轮 参考报告样本。正式交付为针对你 Entry 的 PDF，含一次修订。",
  },
  {
    sku: "b",
    stem: "gw5-916934-b49",
    sampleStem: "gw5-sample-b-49",
    legacySample: "gw4-sample-b-49",
    title: "FALEAGUE PRO · GW5 · FALEAGUE-AI FC · B · ¥49 · 4轮套餐",
    skuLabel: "报告样本 · B ¥49 · 4轮套餐",
    evidenceN: 5,
    climb: true,
    watermark:
      "FALEAGUE PRO · 参考报告样本（Entry 916934 · AI League）· 非买家真实交付件 · 报告样本 · B ¥49 · 4轮套餐",
    footer:
      "本文件为 B · 4轮套餐 参考报告样本（含「规划 4 轮内冲击小联赛冠军」）。正式交付每轮更新剩余窗口规划。",
  },
];

async function htmlToPdf(browser, htmlPath, pdfPath) {
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete ||
          new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          }),
      ),
    );
  });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "11mm", bottom: "14mm", left: "10mm", right: "10mm" },
  });
  await page.close();
}

async function main() {
  const outReports = join(root, "output", "reports");
  const outPublic = join(root, "public", "pro", "deliveries");
  const outSamples = join(root, "public", "pro", "samples");
  mkdirSync(outReports, { recursive: true });
  mkdirSync(outPublic, { recursive: true });
  mkdirSync(outSamples, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    for (const v of variants) {
      const htmlBody = body({
        skuLabel: v.skuLabel,
        climb: v.climb ? climbBlock() : "",
        evidenceN: v.evidenceN,
        watermark: v.watermark,
        footer: v.footer,
      });
      const html = wrapHtml({
        title: v.title,
        htmlBody,
        buyBarSku: null,
      });
      const sampleHtml = wrapHtml({
        title: v.title,
        htmlBody,
        buyBarSku: v.sku,
      });
      const htmlPath = join(outReports, `${v.stem}.html`);
      const pdfPath = join(outReports, `${v.stem}.pdf`);
      writeFileSync(htmlPath, html, "utf8");
      await htmlToPdf(browser, htmlPath, pdfPath);

      copyFileSync(htmlPath, join(outPublic, `${v.stem}.html`));
      copyFileSync(pdfPath, join(outPublic, `${v.stem}.pdf`));

      writeFileSync(join(outSamples, `${v.sampleStem}.html`), sampleHtml, "utf8");
      writeFileSync(join(outSamples, `${v.legacySample}.html`), sampleHtml, "utf8");
      copyFileSync(pdfPath, join(outSamples, `${v.sampleStem}.pdf`));
      copyFileSync(pdfPath, join(outSamples, `${v.legacySample}.pdf`));

      console.log("wrote", v.stem);
    }
  } finally {
    await browser.close();
  }
  console.log("samples:");
  console.log("  /pro/samples/gw5-sample-a-19.html");
  console.log("  /pro/samples/gw5-sample-b-49.html");
  console.log("  (gw4-sample-* overwritten as aliases)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
