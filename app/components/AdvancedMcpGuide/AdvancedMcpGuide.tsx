import { useMemo } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {
  getMcpToolReference,
  MCP_PROMPT_TEMPLATES,
  MCP_SERVER_INFO,
  MCP_SERVER_INSTRUCTIONS,
} from '../../../shared/agent/reference';

export default function AdvancedMcpGuide() {
  const tools = useMemo(() => getMcpToolReference(), []);

  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border bg-muted/30 p-3">
        <dt className="text-muted-foreground">Server</dt>
        <dd className="font-mono">{MCP_SERVER_INFO.name}</dd>
        <dt className="text-muted-foreground">Version</dt>
        <dd className="font-mono">{MCP_SERVER_INFO.version}</dd>
        <dt className="text-muted-foreground">Tools</dt>
        <dd>{tools.length} exposed functions</dd>
      </dl>

      <Accordion type="multiple">
        <AccordionItem value="instructions">
          <AccordionTrigger className="pt-0">
            Agent prompt & instructions
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-muted-foreground">
            {MCP_SERVER_INSTRUCTIONS ? (
              <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs text-foreground">
                {MCP_SERVER_INSTRUCTIONS}
              </pre>
            ) : (
              <p>
                This server does not provide a server-wide prompt or
                instructions. The app does not set your assistant’s system
                prompt.
              </p>
            )}
            <p>
              Agents receive the tool names, descriptions, input/output schemas,
              and annotations shown below. Tool descriptions are reproduced
              verbatim from the shared registry.
            </p>
            <p>
              Registered MCP prompt templates: {MCP_PROMPT_TEMPLATES.length}.
              The example requests in Guide mode are suggestions for you, not
              prompts sent automatically to an agent.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="calling">
          <AccordionTrigger>Connection & calling conventions</AccordionTrigger>
          <AccordionContent className="space-y-3 text-muted-foreground">
            <p>
              Desktop and local Chrome use Streamable HTTP at the MCP address in
              AI connection. Authentication is an HTTP header:
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs text-foreground">
              Authorization: Bearer YOUR_TOKEN
            </pre>
            <p>
              Use <code>tools/list</code> to discover tools and{' '}
              <code>tools/call</code> to call one. Example request:
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs text-foreground">
              {JSON.stringify(
                {
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'tools/call',
                  params: {
                    name: 'get_scale',
                    arguments: { scale: 'B major' },
                  },
                },
                null,
                2,
              )}
            </pre>
            <p>
              Tool-handler results contain{' '}
              <code>{'{ ok: true, data: … }'}</code> or{' '}
              <code>{'{ ok: false, error: { code, message } }'}</code> in both{' '}
              <code>structuredContent</code> and JSON text content. Failed tools
              also set <code>isError</code>. SDK argument-validation errors can
              return text-only errors without <code>structuredContent</code>.
              Protocol and authentication failures may use MCP or HTTP errors.
            </p>
            <p>
              For tools that target a view, supply <code>sessionId</code> when
              multiple views are connected. Get the ID from{' '}
              <code>list_sessions</code>. View mutations can include{' '}
              <code>expectedRevision</code> from <code>get_state</code> to
              reject stale changes. Read state before retrying an acknowledgment
              timeout.
            </p>
            <p>
              Strings and tuning arrays run high to low; string 1 is the high
              string. Fret 0 is open. A <code>null</code> voicing fret is muted.
              Voicing indices start at 0.
            </p>
            <p>
              Schemas describe accepted fields. Runtime validation also checks
              scale membership, tuning, and position bounds. Supply only one of{' '}
              <code>notes</code>, <code>chord</code>, or <code>positions</code>{' '}
              to <code>show_fretboard</code>.
            </p>
            <p>
              Optional native Chrome WebMCP uses the same tools for{' '}
              <code>current-tab</code>; it returns JSON strings and uses
              browser-specific annotations. The schemas and annotations below
              describe the standard MCP endpoint.
            </p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="song-analysis">
          <AccordionTrigger>Song analysis workflow</AccordionTrigger>
          <AccordionContent className="space-y-3 text-muted-foreground">
            <p>
              Connect to the desktop endpoint for song analysis. Check{' '}
              <code>get_capabilities.songAnalysis.available</code> for host
              support. The standalone Chrome host and native WebMCP return{' '}
              <code>ANALYZER_UNAVAILABLE</code> for these tools. No selected
              scale or <code>sessionId</code> is required.
            </p>
            <p>
              Call <code>analyze_song</code> with a <code>query</code>{' '}
              containing a song name and artist, or a direct YouTube URL. Song
              searches use the first YouTube result. The desktop app saves an
              MP3 to its configured folder and estimates key and BPM. In an open
              dashboard window, the analyzer tab is selected automatically.
            </p>
            <p>
              The call returns a job immediately. Poll{' '}
              <code>get_song_analysis</code> every few seconds with the returned{' '}
              <code>jobId</code> until it reaches a terminal status:{' '}
              <code>complete</code>, <code>error</code> or{' '}
              <code>cancelled</code>. Omit the ID to read the current job. Use{' '}
              <code>cancel_song_analysis</code> with its exact ID to cancel.
              Human and AI requests share one job slot; a busy analyzer rejects
              another start. Read the current job before retrying an uncertain
              start.
            </p>
            <p>
              Public snapshots contain <code>jobId</code>, <code>status</code>,{' '}
              <code>query</code>, matched YouTube <code>source</code>,{' '}
              <code>analysis</code>, and <code>error</code>. Snapshots omit
              destination and file-path fields. The latest eight finished jobs
              remain readable until the app restarts. Key and tempo are
              estimates with confidence values. To apply a result when asked,
              call <code>set_view</code> with <code>analysis.keyScale</code> if
              it is non-null; analysis alone leaves the fretboard unchanged.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <section aria-label="Exposed MCP tools">
        <h3 className="mb-1 font-semibold">Tools ({tools.length})</h3>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          Generated from this app build’s MCP registry. Expand a function to
          inspect its agent-facing description and complete JSON schemas.
        </p>
        <Accordion type="multiple">
          {tools.map(tool => (
            <AccordionItem key={tool.name} value={tool.name}>
              <AccordionTrigger className="gap-2 py-3 hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                  <code className="break-all text-xs">{tool.name}</code>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                    {tool.annotations.readOnlyHint
                      ? 'Read only'
                      : tool.annotations.openWorldHint
                        ? 'Downloads audio'
                        : 'Changes app'}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Agent-facing description
                  </h4>
                  <p className="text-sm leading-relaxed">{tool.description}</p>
                </div>
                {[
                  { label: 'Input schema', value: tool.inputSchema },
                  { label: 'Output schema', value: tool.outputSchema },
                  { label: 'Annotations', value: tool.annotations },
                ].map(({ label, value }) => (
                  <details
                    key={label}
                    className="rounded-md border bg-muted/20"
                  >
                    <summary className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      {label}
                    </summary>
                    <pre className="whitespace-pre-wrap break-words border-t px-3 py-3 font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </details>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
