/** Tracking / consent cookies — not needed for FPL API fetch. */
const DROP_NAME_PREFIXES = [
  "Optanon",
  "_gcl_",
  "_gads",
  "_gpi",
  "_eoi",
  "_scid",
  "tt_enable",
  "twpid",
  "_ga",
  "_gid",
  "_fbp",
  "eupubconsent",
  "ncmp.",
  "panorama",
  "addtl_consent",
  "usprivacy",
];

function cookieName(pair: string): string {
  return pair.split("=")[0]?.trim() ?? "";
}

/** Strip analytics/consent cookies; keep auth/session pairs like `pl_profile`. */
export function trimFplSessionCookie(raw: string): string {
  const parts = raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => {
    const name = cookieName(part);
    if (!name) return false;
    return !DROP_NAME_PREFIXES.some(
      (prefix) => name.startsWith(prefix) || name === prefix,
    );
  });
  return kept.join("; ");
}

export function fplSessionCookieLooksValid(raw: string): boolean {
  const trimmed = trimFplSessionCookie(raw);
  if (!trimmed) return false;
  return /pl_profile=/i.test(trimmed) || /sessionid=/i.test(trimmed);
}
