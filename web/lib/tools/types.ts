/**
 * Provider-agnostic JSON Schema subset used by our tool declarations.
 * Values mirror OpenAPI 3.0 (lowercase), the same subset Claude / Gemini /
 * OpenAI accept. Each provider adapter normalizes as needed.
 */
export interface JsonSchema {
  type?:
    | "object"
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "null";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number | boolean>;
}

/**
 * Runtime context passed to every tool handler. Lets a tool reach Supabase
 * without importing it directly (easier to test / stub).
 */
export interface ToolContext {
  entryId: string | null;
}

export type ToolInput = Record<string, unknown>;

export interface ToolHandler {
  name: string;
  description: string;
  input_schema: JsonSchema;
  run: (input: ToolInput, ctx: ToolContext) => Promise<unknown>;
}
