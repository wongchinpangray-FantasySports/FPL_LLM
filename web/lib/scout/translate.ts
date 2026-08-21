import { DEFAULT_MODEL, getGenAI } from "@/lib/llm";

/** Opt-in Gemini. Default ingest is collect-only; Ray queues Cursor from /admin. */

const CHUNK_CHARS = 10_000;

export type ScoutTranslation = {
  title_zh: string;
  excerpt_zh: string;
  body_html_zh: string;
  model: string;
};

function extractText(resp: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }): string {
  return (resp.candidates?.[0]?.content?.parts ?? [])
    .map((p) => ("text" in p ? p.text ?? "" : ""))
    .join("")
    .trim();
}

function unwrapHtmlFence(text: string): string {
  return text
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function generate(prompt: string, temperature = 0.2): Promise<string> {
  const ai = await getGenAI();
  const resp = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature },
  });
  return extractText(resp);
}

async function translateTitle(titleEn: string): Promise<string> {
  const text = await generate(
    `将以下 Fantasy Football Scout 英文标题译为简体中文。只返回译文，不要引号或解释。保留球员英文名。\n\n${titleEn}`,
    0.15,
  );
  return text.replace(/^["“]|["”]$/g, "").trim() || titleEn;
}

async function translateExcerpt(excerptEn: string): Promise<string> {
  if (!excerptEn.trim()) return "";
  const text = await generate(
    `将以下 FPL 文章导语译为简体中文。只返回译文。保留球员英文名与 £ 身价。\n\n${excerptEn}`,
    0.2,
  );
  return text.trim();
}

function splitHtmlChunks(html: string): string[] {
  if (html.length <= CHUNK_CHARS) return [html];
  const parts: string[] = [];
  let rest = html;
  while (rest.length > CHUNK_CHARS) {
    const window = rest.slice(0, CHUNK_CHARS);
    const cut =
      window.lastIndexOf("</p>") >= 0
        ? window.lastIndexOf("</p>") + 4
        : window.lastIndexOf("</h2>") >= 0
          ? window.lastIndexOf("</h2>") + 5
          : window.lastIndexOf(">") >= 0
            ? window.lastIndexOf(">") + 1
            : CHUNK_CHARS;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) parts.push(rest);
  return parts;
}

async function translateHtmlChunk(html: string, index: number, total: number): Promise<string> {
  const prompt = `你是 Fantasy Football Scout 授权的中文本地化译者。将下面 HTML 片段译为简体中文，供中国 FPL 经理阅读。

硬性规则：
- 只返回 HTML，不要 Markdown 围栏或前言
- 保留全部标签与属性，尤其是 <img src>、<a href>、表格结构
- 不得增删事实、数据、身价或球员
- 球员姓名保留英文原名（可在首次出现后加常见中文译名，如 Haaland（哈兰德））
- 俱乐部可用惯用中文名（利物浦、曼城等）
- 不要翻译 Fantasy Football Scout / FPL / DefCon / xG / xA / xP / GW 等专有名词
- 这是第 ${index + 1}/${total} 段

HTML：
${html}`;

  const text = unwrapHtmlFence(await generate(prompt, 0.2));
  return text || html;
}

export async function translateScoutArticle(input: {
  title_en: string;
  excerpt_en: string;
  body_html_en: string;
}): Promise<ScoutTranslation> {
  const chunks = splitHtmlChunks(input.body_html_en);
  const title_zh = await translateTitle(input.title_en);
  const excerpt_zh = await translateExcerpt(input.excerpt_en);
  const translated: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    translated.push(await translateHtmlChunk(chunks[i]!, i, chunks.length));
  }
  return {
    title_zh,
    excerpt_zh,
    body_html_zh: translated.join("\n"),
    model: DEFAULT_MODEL,
  };
}
