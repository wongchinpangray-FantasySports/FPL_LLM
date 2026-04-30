import type { ToolHandler } from "./types";
import { playerTools } from "./players";
import { fixtureTools } from "./fixtures";
import { teamTools } from "./team";
import { fetchUrlTools } from "./fetch_url";

export const ALL_TOOLS: ToolHandler[] = [
  ...playerTools,
  ...fixtureTools,
  ...teamTools,
  ...fetchUrlTools,
];

export function findTool(name: string): ToolHandler | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export type {
  JsonSchema,
  ToolContext,
  ToolHandler,
  ToolInput,
} from "./types";
