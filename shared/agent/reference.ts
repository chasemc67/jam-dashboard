import { agentTools } from './tools';

export const MCP_SERVER_INFO = {
  name: 'jam-dashboard',
  version: '1.1.0',
} as const;

// No server-wide instructions or prompt templates are currently registered.
// The integration tests verify this metadata against the live MCP handshake.
export const MCP_SERVER_INSTRUCTIONS: string | undefined = undefined;
export const MCP_PROMPT_TEMPLATES: readonly [] = [];

export type McpToolReference = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly outputSchema: Readonly<Record<string, unknown>>;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
  };
};

/**
 * The public tool definitions, without execution handlers or app credentials.
 * Use the same Standard JSON Schema conversion and draft as the MCP SDK.
 * Keeping this browser-safe lets the guide work without a running MCP service.
 */
export function getMcpToolReference(): readonly McpToolReference[] {
  return agentTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema['~standard'].jsonSchema.input({
      target: 'draft-2020-12',
    }),
    outputSchema: tool.outputSchema['~standard'].jsonSchema.output({
      target: 'draft-2020-12',
    }),
    annotations: { ...tool.annotations },
  }));
}
