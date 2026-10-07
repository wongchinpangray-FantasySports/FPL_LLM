import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MARKER = "fplllm-keepwarm";
const SCHEDULED = `    async scheduled(_event, env, ctx) {
        /* ${MARKER} */
        const ping = (pathname) => {
            const request = new Request(\`https://www.faleague-ai.com\${pathname}\`, {
                headers: { "User-Agent": "fplllm-keepwarm" },
            });
            return env.WORKER_SELF_REFERENCE
                ? env.WORKER_SELF_REFERENCE.fetch(request)
                : fetch(request);
        };
        ctx.waitUntil(Promise.all([
            ping("/"),
            ping("/pro"),
            ping("/api/home/hub?locale=zh"),
        ]));
    },
`;

const NEEDLE = `            return handler(reqOrResp, env, ctx);
        });
    },
};`;

const REPLACEMENT = `            return handler(reqOrResp, env, ctx);
        });
    },
${SCHEDULED}};`;

function patchWorker(filePath) {
  if (!existsSync(filePath)) return;
  const src = readFileSync(filePath, "utf8");
  if (src.includes(`/* ${MARKER} */`)) return;
  if (!src.includes(NEEDLE)) {
    console.warn(`Keep-warm patch target not found in ${filePath}`);
    return;
  }
  writeFileSync(filePath, src.replace(NEEDLE, REPLACEMENT));
}

const root = path.join(process.cwd(), ".open-next");
patchWorker(path.join(root, "worker.js"));
patchWorker(path.join(root, "cloudflare-templates", "worker.js"));
