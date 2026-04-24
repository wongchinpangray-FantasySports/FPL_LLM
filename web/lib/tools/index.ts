import type { ToolHandler } from "./types";
import { playerTools } from "./players";
import { fixtureTools } from "./fixtures";
import { teamTools } from "./team";

export const ALL_TOOLS: ToolHandler[] = [
  ...playerTools,
  ...fixtureTools,
  ...teamTools,
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
