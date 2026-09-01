/**
 * Prepare pitch DOM for html-to-image export (mobile Safari / WebP kits).
 * Inlines shirt images as PNG data URLs and returns a restore function.
 */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function blobToPngDataUrl(blob: Blob): Promise<string> {
  if (blob.type === "image/png") {
    return blobToDataUrl(blob);
  }
  if (typeof createImageBitmap !== "function") {
    return blobToDataUrl(blob);
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blobToDataUrl(blob);
    ctx.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

async function inlineImage(img: HTMLImageElement): Promise<() => void> {
  const prevSrc = img.src;
  const prevSrcset = img.getAttribute("srcset");
  const prevCross = img.crossOrigin;

  try {
    if (typeof img.decode === "function") {
      await img.decode().catch(() => undefined);
    }
    const raw = img.currentSrc || img.src;
    if (!raw || raw.startsWith("data:")) {
      return () => {};
    }

    const abs = new URL(raw, window.location.origin).href;
    const res = await fetch(abs, { credentials: "same-origin" });
    if (!res.ok) return () => {};

    const blob = await res.blob();
    const dataUrl = await blobToPngDataUrl(blob);
    img.crossOrigin = "anonymous";
    img.removeAttribute("srcset");
    img.src = dataUrl;
    if (typeof img.decode === "function") {
      await img.decode().catch(() => undefined);
    }

    return () => {
      img.src = prevSrc;
      if (prevSrcset != null) img.setAttribute("srcset", prevSrcset);
      else img.removeAttribute("srcset");
      if (prevCross) img.crossOrigin = prevCross;
      else img.removeAttribute("crossorigin");
    };
  } catch {
    return () => {};
  }
}

/** Inline kit images so foreignObject export includes shirts on iOS / mobile. */
export async function preparePitchForPngExport(
  root: HTMLElement,
): Promise<() => void> {
  const restores: Array<() => void> = [];

  root.querySelectorAll<HTMLElement>("[class*='backdrop-blur']").forEach((el) => {
    const prevFilter = el.style.backdropFilter;
    const prevWebkit = el.style.getPropertyValue("-webkit-backdrop-filter");
    el.style.backdropFilter = "none";
    el.style.setProperty("-webkit-backdrop-filter", "none");
    restores.push(() => {
      el.style.backdropFilter = prevFilter;
      if (prevWebkit) el.style.setProperty("-webkit-backdrop-filter", prevWebkit);
      else el.style.removeProperty("-webkit-backdrop-filter");
    });
  });

  const shirts = Array.from(
    root.querySelectorAll<HTMLImageElement>("img[data-pitch-shirt]"),
  );
  const shirtRestores = await Promise.all(shirts.map((img) => inlineImage(img)));
  restores.push(...shirtRestores);

  return () => {
    for (const restore of restores) restore();
  };
}

export function pitchExportPixelRatio(): number {
  if (typeof window === "undefined") return 2;
  const dpr = window.devicePixelRatio || 1;
  const narrow = window.innerWidth < 640;
  return narrow ? Math.min(1.5, dpr) : Math.min(2, dpr);
}
