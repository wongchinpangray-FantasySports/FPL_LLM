import dns from "node:dns/promises";
import net from "node:net";
import type { ToolHandler } from "./types";

const MAX_URL_LENGTH = 2048;
const MAX_BYTES = 512_000;
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_TEXT_CHARS = 14_000;

const USER_AGENT =
  "FALEAGUE-AI/1.0 (+https://github.com/wongchinpangray-FantasySports/FPL_LLM; public page fetch for chat)";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIP(ip) === 4) return isBlockedIpv4(ip);
  if (net.isIP(ip) === 6) {
    const u = ip.toLowerCase();
    if (u === "::1") return true;
    if (u.startsWith("fe80:")) return true;
    if (u.startsWith("fc") || u.startsWith("fd")) return true;
    if (u.startsWith("::ffff:")) {
      const v4 = u.slice(7);
      if (net.isIPv4(v4)) return isBlockedIpv4(v4);
    }
    return false;
  }
  return true;
}

async function assertSafeHostname(hostname: string): Promise<void> {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h || h.length > 253) {
    throw new Error("Invalid hostname");
  }
  if (BLOCKED_HOSTNAMES.has(h)) {
    throw new Error("Hostname is not allowed");
  }
  if (h.endsWith(".local") || h.endsWith(".internal")) {
    throw new Error("Hostname is not allowed");
  }
  if (net.isIP(h) !== 0) {
    if (isBlockedIp(h)) throw new Error("IP target is not allowed");
    return;
  }
  const records = await dns.lookup(h, { all: true });
  if (!records.length) throw new Error("Host could not be resolved");
  for (const { address } of records) {
    if (isBlockedIp(address)) {
      throw new Error("Resolved address is not allowed");
    }
  }
}

function assertSafeUrl(urlStr: string): URL {
  if (urlStr.length > MAX_URL_LENGTH) {
    throw new Error(`URL exceeds ${MAX_URL_LENGTH} characters`);
  }
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.username || url.password) {
    throw new Error("URLs with credentials are not allowed");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "443" && port !== "80") {
    throw new Error("Only default ports (80 for http, 443 for https) are allowed");
  }
  const host = url.hostname;
  if (!host) throw new Error("Missing hostname");
  return url;
}

async function readBodyCapped(res: Response): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = res.body?.getReader();
  if (!reader) {
    return { bytes: new Uint8Array(0), truncated: false };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      if (total + value.length > MAX_BYTES) {
        const rest = MAX_BYTES - total;
        if (rest > 0) chunks.push(value.subarray(0, rest));
        total = MAX_BYTES;
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return { bytes: out, truncated };
}

function htmlToPlainText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : " ";
    });
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ").trim();
  return s;
}

async function fetchPublicPageInner(urlStr: string): Promise<unknown> {
  let current = urlStr.trim();
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = assertSafeUrl(current);
    await assertSafeHostname(url.hostname);

    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc || hop === MAX_REDIRECTS) {
        return {
          ok: false,
          error: loc ? "Too many redirects" : "Redirect without Location header",
          final_url: current,
        };
      }
      current = new URL(loc, current).href;
      continue;
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status}`,
        final_url: current,
      };
    }

    const ct = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    const { bytes, truncated: bodyTruncated } = await readBodyCapped(res);
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(bytes);

    if (
      ct &&
      !ct.includes("text/html") &&
      !ct.includes("text/plain") &&
      !ct.includes("application/xhtml") &&
      !ct.includes("application/xml") &&
      !ct.includes("text/xml")
    ) {
      return {
        ok: true,
        final_url: current,
        content_type: ct,
        note:
          "Non-text content type; body not interpreted as HTML. First bytes returned as preview only.",
        preview: text.slice(0, 800),
        bytes_read: bytes.length,
        body_truncated: bodyTruncated,
      };
    }

    if (ct.includes("text/html") || ct.includes("application/xhtml") || ct.includes("xml")) {
      text = htmlToPlainText(text);
    }

    let textTruncated = false;
    if (text.length > MAX_TEXT_CHARS) {
      text = text.slice(0, MAX_TEXT_CHARS);
      textTruncated = true;
    }

    return {
      ok: true,
      final_url: current,
      content_type: ct || null,
      text,
      text_characters: text.length,
      body_truncated: bodyTruncated,
      text_truncated: textTruncated,
      note:
        "Plain text extracted for reading. Many social networks (X, Instagram, etc.) return login walls or empty shells — if text is empty or useless, tell the user the page could not be read and suggest pasting the quote.",
    };
  }

  return { ok: false, error: "Redirect loop", final_url: current };
}

const fetchPublicPage: ToolHandler = {
  name: "fetch_public_page",
  description:
    "Fetch a single public HTTP(S) URL and return a plain-text excerpt (HTML stripped). " +
    "Use when the user shares a link to a news article, club site, blog, etc. " +
    "Does NOT log in; X/Twitter and most social URLs often return no usable text — say so if empty. " +
    "Only http/https on default ports; SSRF-protected.",
  input_schema: {
    type: "object",
    required: ["url"],
    properties: {
      url: {
        type: "string",
        description: "Full https:// or http:// URL to fetch (max one page).",
      },
    },
  },
  async run(input) {
    const url = typeof input.url === "string" ? input.url.trim() : "";
    if (!url) {
      return { ok: false, error: "url is required" };
    }
    try {
      return await fetchPublicPageInner(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  },
};

export const fetchUrlTools: ToolHandler[] = [fetchPublicPage];
