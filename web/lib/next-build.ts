/** True while `next build` is generating static pages (OpenNext / Cloudflare CI). */
export function isNextProductionBuild(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export"
  );
}
