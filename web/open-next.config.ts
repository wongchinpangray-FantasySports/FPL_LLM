import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/** Dummy caches — add R2 incremental cache later if you need ISR on Workers. */
export default defineCloudflareConfig();
