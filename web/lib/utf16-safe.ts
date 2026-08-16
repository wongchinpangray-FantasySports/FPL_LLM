/**
 * Postgres JSONB / PostgREST require valid UTF-8. Lone UTF-16 surrogates
 * (often from mid-emoji string truncation) serialize as JSON escapes but
 * fail with PGRST102 "Empty or invalid json".
 */
export function sanitizeUtf16(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += input[i] + input[i + 1];
        i++;
      }
      // drop lone high surrogate
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      // drop lone low surrogate
    } else if (c !== 0) {
      out += input[i];
    }
  }
  return out;
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
