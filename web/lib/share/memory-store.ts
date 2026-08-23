import { randomShareCode } from "@/lib/share/codes";
import type { ShareKind, ShareLink } from "@/lib/share/types";

type Store = {
  byCode: Map<string, ShareLink>;
  byPath: Map<string, string>;
  views: Set<string>;
};

const g = globalThis as typeof globalThis & { __flShareMem?: Store };

function mem(): Store {
  if (!g.__flShareMem) {
    g.__flShareMem = {
      byCode: new Map(),
      byPath: new Map(),
      views: new Set(),
    };
  }
  return g.__flShareMem;
}

function pathKey(kind: ShareKind, targetPath: string): string {
  return `${kind}:${targetPath}`;
}

export function memoryGetShareByCode(code: string): ShareLink | null {
  return mem().byCode.get(code.toLowerCase()) ?? null;
}

export function memoryUpsertShareLink(input: {
  kind: ShareKind;
  target_path: string;
  title: string;
  ref_id?: string | null;
}): ShareLink {
  const store = mem();
  const key = pathKey(input.kind, input.target_path);
  const existingCode = store.byPath.get(key);
  if (existingCode) {
    const existing = store.byCode.get(existingCode);
    if (existing) {
      const next = {
        ...existing,
        title: input.title || existing.title,
        ref_id: input.ref_id ?? existing.ref_id,
      };
      store.byCode.set(existing.code, next);
      return next;
    }
  }
  const link: ShareLink = {
    id: crypto.randomUUID(),
    code: randomShareCode(),
    kind: input.kind,
    target_path: input.target_path,
    title: input.title,
    ref_id: input.ref_id ?? null,
    created_at: new Date().toISOString(),
  };
  store.byCode.set(link.code, link);
  store.byPath.set(key, link.code);
  return link;
}

export function memoryHasShareView(shareId: string, visitorId: string): boolean {
  return mem().views.has(`${shareId}:${visitorId}`);
}

export function memoryRecordShareView(
  shareId: string,
  visitorId: string,
): "first" | "repeat" {
  const key = `${shareId}:${visitorId}`;
  const store = mem();
  if (store.views.has(key)) return "repeat";
  store.views.add(key);
  return "first";
}
