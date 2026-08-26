import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const vendorPatchFile = path.join(
  process.cwd(),
  "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/ast/patch-vercel-og-library.js",
);

function patchVendorOgRename() {
  if (!existsSync(vendorPatchFile)) {
    console.warn("OpenNext OG vendor file missing; skipping rename guard.");
    return;
  }

  const src = readFileSync(vendorPatchFile, "utf8");
  if (src.includes("/* faleague-og-guard */")) {
    return;
  }

  const needle = `            const fontFileName = matches[0].getMatch("PATH").text();
            renameSync(path.join(outputDir, fontFileName), path.join(outputDir, \`\${fontFileName}.bin\`));`;

  const insert = `            const fontFileName = matches[0].getMatch("PATH").text();
            /* faleague-og-guard */
            const fontSrc = path.join(outputDir, fontFileName);
            if (!existsSync(fontSrc)) {
                const fromApp = path.join(appBuildOutputPath, "node_modules/next/dist/compiled/@vercel/og", fontFileName);
                if (existsSync(fromApp)) copyFileSync(fromApp, fontSrc);
            }
            if (existsSync(fontSrc) && !existsSync(path.join(outputDir, \`\${fontFileName}.bin\`))) {
                renameSync(fontSrc, path.join(outputDir, \`\${fontFileName}.bin\`));
            }`;

  if (!src.includes(needle)) {
    console.warn("OpenNext OG patch target not found; leaving vendor file unchanged.");
    return;
  }

  writeFileSync(vendorPatchFile, src.replace(needle, insert));
}

const ABSOLUTE_OG_ASSET =
  /(["'])(?:file:\/\/\/?)?(?:[A-Za-z]:)?(?:\/|\\)[^"'?]*(?:\/|\\)node_modules(?:\/|\\)next(?:\/|\\)dist(?:\/|\\)compiled(?:\/|\\)@vercel(?:\/|\\)og(?:\/|\\)([^"'?]+)(\?[^"']*)?\1/g;

function toRelativeOgImport(_full, quote, filename, query = "") {
  return `${quote}./node_modules/next/dist/compiled/@vercel/og/${filename.replaceAll("\\", "/")}${query}${quote}`;
}

function rewriteFile(file) {
  const src = readFileSync(file, "utf8");
  const next = src.replace(ABSOLUTE_OG_ASSET, toRelativeOgImport);
  if (next === src) return false;
  writeFileSync(file, next);
  return true;
}

function walkOpenNext(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walkOpenNext(p, out);
      continue;
    }
    if (name === "handler.mjs" || name === "worker.js") out.push(p);
  }
}

function copyOgWasmIntoOpenNext() {
  const destDir = path.join(
    process.cwd(),
    ".open-next/server-functions/default/node_modules/next/dist/compiled/@vercel/og",
  );
  const srcDir = path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og");
  mkdirSync(destDir, { recursive: true });
  for (const name of ["resvg.wasm", "yoga.wasm"]) {
    const dest = path.join(destDir, name);
    const src = path.join(srcDir, name);
    if (existsSync(dest) || !existsSync(src)) continue;
    copyFileSync(src, dest);
    console.log(`Copied ${name} into OpenNext @vercel/og output`);
  }
}

function rewriteAbsoluteOgImports() {
  const openNextDir = path.join(process.cwd(), ".open-next");
  if (!existsSync(openNextDir)) {
    console.warn("No .open-next output; skipping wasm path rewrite.");
    return;
  }

  copyOgWasmIntoOpenNext();

  const files = [];
  walkOpenNext(openNextDir, files);
  let changed = 0;
  for (const file of files) {
    if (rewriteFile(file)) {
      changed += 1;
      console.log(`Rewrote @vercel/og asset imports in ${path.relative(process.cwd(), file)}`);
    }
  }

  const leftover = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const re = /(?:from|import)\s*["']([^"']*(?:\.wasm|\.ttf|\.bin)[^"']*)["']/g;
    let m;
    while ((m = re.exec(src))) {
      const spec = m[1];
      if (/^(?:file:\/\/|[A-Za-z]:[\\/]|\/)/.test(spec)) leftover.push(`${file}: ${spec}`);
    }
  }
  if (leftover.length) {
    throw new Error(
      `Absolute @vercel/og asset imports remain after rewrite:\n${leftover.join("\n")}`,
    );
  }
  if (!changed) {
    console.log("No absolute @vercel/og asset imports to rewrite.");
  }
}

const rewriteOnly = process.argv.includes("--rewrite");
if (!rewriteOnly) patchVendorOgRename();
if (rewriteOnly || process.argv.includes("--rewrite-if-present")) {
  rewriteAbsoluteOgImports();
}
