/**
 * Split Scout article HTML so anonymous readers only get a preview (~half).
 * Cuts on top-level block boundaries; never invents content.
 */

const BLOCK_OPEN =
  /<(p|h[1-6]|ul|ol|figure|blockquote|table|hr|div|section)(\s[^>]*)?>/i;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatchingClose(html: string, openIdx: number): number {
  const openMatch = html.slice(openIdx).match(/^<([a-z0-9]+)(\s[^>]*)?>/i);
  if (!openMatch) return openIdx;
  const tag = openMatch[1]!.toLowerCase();
  if (tag === "hr") {
    const end = html.indexOf(">", openIdx);
    return end >= 0 ? end + 1 : openIdx;
  }
  const re = new RegExp(`</?${tag}\\b[^>]*>`, "gi");
  re.lastIndex = openIdx;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const token = m[0];
    if (/^<\//.test(token)) {
      depth -= 1;
      if (depth === 0) return m.index + token.length;
    } else if (!/\/>$/.test(token)) {
      depth += 1;
    }
  }
  return html.length;
}

/** Top-level block elements in document order. */
export function splitScoutHtmlBlocks(html: string): string[] {
  const input = html.trim();
  if (!input) return [];
  const blocks: string[] = [];
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /\s/.test(input[i]!)) i += 1;
    if (i >= input.length) break;
    const slice = input.slice(i);
    const open = slice.match(BLOCK_OPEN);
    if (!open || open.index == null) {
      const next = input.slice(i).search(/<(?:p|h[1-6]|ul|ol|figure|blockquote|table|hr|div|section)\b/i);
      if (next < 0) {
        const rest = input.slice(i).trim();
        if (rest) blocks.push(rest);
        break;
      }
      const loose = input.slice(i, i + next).trim();
      if (loose) blocks.push(loose);
      i += next;
      continue;
    }
    if (open.index > 0) {
      const loose = slice.slice(0, open.index).trim();
      if (loose) blocks.push(loose);
      i += open.index;
    }
    const end = findMatchingClose(input, i);
    blocks.push(input.slice(i, end));
    i = end;
  }
  return blocks.filter((b) => b.trim().length > 0);
}

export function splitScoutPreviewHtml(
  html: string,
  ratio = 0.5,
): { previewHtml: string; remainderHtml: string; gated: boolean } {
  const blocks = splitScoutHtmlBlocks(html);
  if (blocks.length === 0) {
    return { previewHtml: html, remainderHtml: "", gated: false };
  }
  if (blocks.length === 1) {
    const only = blocks[0]!;
    const text = stripTags(only);
    if (text.length < 400) {
      return { previewHtml: only, remainderHtml: "", gated: false };
    }
    // Prefer cutting after a mid-article </p>.
    const paras = only.split(/(?<=<\/p>)/i).filter((p) => p.trim());
    if (paras.length >= 2) {
      const weights = paras.map((p) => stripTags(p).length || 1);
      const total = weights.reduce((a, b) => a + b, 0);
      let acc = 0;
      let cut = Math.max(1, paras.length - 1);
      for (let i = 0; i < paras.length; i++) {
        acc += weights[i]!;
        if (acc >= total * ratio) {
          cut = Math.min(Math.max(1, i + 1), paras.length - 1);
          break;
        }
      }
      return {
        previewHtml: paras.slice(0, cut).join(""),
        remainderHtml: paras.slice(cut).join(""),
        gated: true,
      };
    }
    return { previewHtml: only, remainderHtml: "", gated: false };
  }

  const weights = blocks.map((b) => stripTags(b).length || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let cut = Math.max(1, blocks.length - 1);
  for (let i = 0; i < blocks.length; i++) {
    acc += weights[i]!;
    if (acc >= total * ratio) {
      cut = Math.min(Math.max(1, i + 1), blocks.length - 1);
      break;
    }
  }

  return {
    previewHtml: blocks.slice(0, cut).join("\n"),
    remainderHtml: blocks.slice(cut).join("\n"),
    gated: cut < blocks.length,
  };
}
