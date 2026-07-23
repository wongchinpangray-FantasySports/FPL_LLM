/** Shared opponent name normalisation for fixture/score matching. */

export const OPPONENT_ALIASES: Record<string, string[]> = {
  "mk dons": ["milton keynes dons", "mk dons fc"],
  blackburn: ["blackburn rovers"],
  walsall: ["walsall fc"],
  wycombe: ["wycombe wanderers"],
  swindon: ["swindon town"],
  dundee: ["dundee fc", "dundee united"],
  northampton: ["northampton town"],
  wrexham: ["wrexham afc"],
  darlington: ["darlington fc"],
  rosenborg: ["rosenborg bk"],
  "st pauli": ["fc st pauli", "st. pauli"],
  annecy: ["fc annecy"],
  porto: ["fc porto"],
  shrewsbury: ["shrewsbury town"],
  wealdstone: ["wealdstone fc"],
};

export function normOpponentName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function opponentNameVariants(opponent: string): string[] {
  const n = normOpponentName(opponent);
  const variants = new Set<string>([n]);

  if (OPPONENT_ALIASES[n]) {
    for (const alias of OPPONENT_ALIASES[n]) {
      variants.add(normOpponentName(alias));
    }
  }

  for (const [key, aliases] of Object.entries(OPPONENT_ALIASES)) {
    if (key === n || aliases.some((a) => normOpponentName(a) === n)) {
      variants.add(key);
      for (const alias of aliases) {
        variants.add(normOpponentName(alias));
      }
    }
  }

  return [...variants];
}

function tokens(name: string): string[] {
  return name.split(" ").filter((t) => t.length > 1 || t === "mk");
}

export function opponentNamesMatch(a: string, b: string): boolean {
  const x = normOpponentName(a);
  const y = normOpponentName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;

  for (const va of opponentNameVariants(a)) {
    for (const vb of opponentNameVariants(b)) {
      if (va === vb) return true;
      if (va.includes(vb) || vb.includes(va)) return true;
      const yTokens = tokens(vb);
      if (yTokens.length > 0 && yTokens.every((t) => va.includes(t))) return true;
      const xTokens = tokens(va);
      if (xTokens.length > 0 && xTokens.every((t) => vb.includes(t))) return true;
    }
  }

  return false;
}
