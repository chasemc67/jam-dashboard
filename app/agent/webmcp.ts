import { z } from 'zod/v4';
import { agentTools } from '../../shared/agent/tools';
import type { AppController, ToolHost } from '../../shared/agent/contract';
import { ToolError } from '../../shared/music/theory';

// Feature detection keeps the standard MCP bridge usable without experimental Chrome APIs.
type ModelContext = {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: unknown;
      annotations: {
        readOnlyHint: boolean;
        consequentialHint: boolean;
        untrustedContentHint: boolean;
      };
      execute: (input: unknown) => Promise<string>;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
};
export function registerWebMcp(
  controller: AppController,
  modelContext: ModelContext,
) {
  const abort = new AbortController();
  const assertTarget = (id?: string) => {
    if (id && id !== 'current-tab')
      throw new ToolError(
        'SESSION_DISCONNECTED',
        'WebMCP controls only current-tab.',
      );
  };
  const host: ToolHost = {
    listSessions: () => [
      {
        id: 'current-tab',
        platform: 'chrome',
        title: 'Jam Dashboard (current tab)',
        revision: controller.read().revision,
        viewReady: controller.read().viewReady,
      },
    ],
    getState: id => {
      assertTarget(id);
      return controller.read();
    },
    execute: (command, id, revision) => {
      assertTarget(id);
      return controller.execute(command, revision);
    },
  };
  const ready = (async () => {
    try {
      for (const tool of agentTools) {
        if (abort.signal.aborted) return;
        await modelContext.registerTool(
          {
            name: tool.name,
            description: tool.description,
            inputSchema: z.toJSONSchema(tool.inputSchema),
            annotations: {
              readOnlyHint: tool.annotations.readOnlyHint,
              consequentialHint: false,
              untrustedContentHint: false,
            },
            execute: async input =>
              JSON.stringify(await tool.execute(input, host)),
          },
          { signal: abort.signal },
        );
      }
    } catch (error) {
      abort.abort();
      throw error;
    }
  })();
  return { ready, dispose: () => abort.abort() };
}
export type { ModelContext };
