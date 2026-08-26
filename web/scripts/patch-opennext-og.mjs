import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const file = path.join(
  process.cwd(),
  "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/ast/patch-vercel-og-library.js",
);

const src = readFileSync(file, "utf8");
if (src.includes("/* faleague-og-guard */")) {
  process.exit(0);
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
  process.exit(0);
}

writeFileSync(file, src.replace(needle, insert));
