/**
 * Postgres JSONB / PostgREST require valid UTF-8. Lone UTF-16 surrogates
 * (often from mid-emoji string truncation) serialize as JSON escapes but
 * fail with PGRST102 "Empty or invalid json".
 *
 * Fast path: scan once and return the original string when it is already
 * valid. The old char-by-char `out +=` loop was O(n²) and 1102'd Workers
 * when sanitizing the news cache / Scout HTML on every request.
 */
export function sanitizeUtf16(input: string): string {
  const len = input.length;
  if (len === 0) return input;

  let i = 0;
  while (i < len) {
    const c = input.charCodeAt(i);
    if (c === 0) break;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < len ? input.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 2;
        continue;
      }
      break;
    }
    if (c >= 0xdc00 && c <= 0xdfff) break;
    i += 1;
  }
  if (i === len) return input;

  const parts: string[] = i > 0 ? [input.slice(0, i)] : [];
  while (i < len) {
    const c = input.charCodeAt(i);
    if (c === 0) {
      i += 1;
      continue;
    }
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < len ? input.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        parts.push(input[i], input[i + 1]);
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) {
      i += 1;
      continue;
    }
    parts.push(input[i]);
    i += 1;
  }
  return parts.join("");
}

/** Truncate without splitting a surrogate pair. */
export function safeTruncate(input: string, max: number): string {
  const s = sanitizeUtf16(input);
  if (s.length <= max) return s;
  let end = max;
  const c = s.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end -= 1;
  return s.slice(0, Math.max(0, end));
}
