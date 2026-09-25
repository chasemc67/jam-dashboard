# Agent tools for Jam Dashboard

V1 exposes music queries and the live fretboard through authenticated, local MCP in the Mac desktop app and the locally served web app in Chrome. The desktop endpoint also exposes YouTube song search, download, and BPM/key analysis. A selected scale is required for visualizations; C major is selected initially. Song analysis does not require a selected scale.

## Start the app

**Desktop (recommended):** open the built Jam Dashboard app. Its MCP service starts inside Electron; the installed app needs no separate Node process. From this checkout, use `npm run desktop:dev`. See [desktop build instructions](../desktop/README.md) for packaging. The endpoint is `http://127.0.0.1:4177/mcp`.

**Chrome:** run `npm ci`, then `npm run agent:dev`, and open `http://127.0.0.1:5173` in Chrome. This one command starts the web app and the same MCP service. The endpoint is `http://127.0.0.1:4178/mcp`. Optional `JAM_WEB_PORT` and `JAM_MCP_PORT` environment variables change the web-mode ports. Use the address printed by the command, including `127.0.0.1`.

Open Agent chat and choose **MCP connection** (beside the AI Gateway key button on desktop) for the endpoint, bearer token and Cursor configuration. Tokens persist across restarts. **Disconnect this view** removes the fretboard view from agent control; pure music queries and desktop song analysis remain available while the service is running. Quit the desktop app or stop `agent:dev` to stop its service.

The round **AI** button in the bottom-left opens an anchored guide. **Guide** offers example requests; **Advanced** lists every exposed tool with its exact agent-facing description, input/output JSON schemas, and annotations from the shared registry. Expand **Agent prompt & instructions** to inspect the server's prompt configuration. This version provides tool descriptions but no server-wide instructions or MCP prompt templates.

The round **Chat** button next to it is an in-app agent (Vercel AI SDK `ToolLoopAgent`) that calls this same local MCP HTTP endpoint. It needs `AI_GATEWAY_API_KEY` (see `.env.example`) and `npm run agent:dev`. The Remix route `/api/agent-chat` discovers the MCP URL and bearer token from `JAM_AGENT_URL` / `JAM_AGENT_TOKEN`, the same values `/__jam-agent/config` exposes to the page.

Voice mode records from a **separate** `getUserMedia` stream (speech echo cancellation on) and POSTs the clip to `/api/agent-transcribe`, which calls the AI SDK `transcribe` helper through AI Gateway (`openai/whisper-1` by default, override with `JAM_AGENT_TRANSCRIBE_MODEL`). In **Dictation** mode the transcript fills the message box and the user presses Send. In **Jev** mode the mic stays on: pause-delimited segments are transcribed the same way, `/api/agent-jev` asks TypeSafe Jev (`typesafe-ai/jev` via AI Gateway, same credential) which suffix of each segment is addressed to the assistant, and accepted spans are sent automatically as normal chat user messages (so MCP tools still run). Ambient, unclear, and failed classifications are never sent; the full transcript view highlights what was. See [`skills/README.md`](../skills/README.md) before changing the Jev integration. Chat remembers its mic in `localStorage` key `jam-agent-chat-voice-device-id`; Note Detector does not use that key and keeps guitar-oriented capture (`echoCancellation: false` in `createInputStream`). Two different hardware inputs can run together. Capturing the same device twice is unreliable in many browsers (`NotReadableError` or a silent/shared track).

The two hosts have independent views and credentials. Running both does not synchronize them. The hosted production website is outside V1; `npm run dev` intentionally does not enable this integration.

## Connect an agent

For Codex, make `JAM_DASHBOARD_MCP_TOKEN` available in the environment of the Codex process, with the value shown in the panel. Then:

```sh
codex mcp add jam_dashboard --url http://127.0.0.1:4177/mcp --bearer-token-env-var JAM_DASHBOARD_MCP_TOKEN
```

Equivalent `~/.codex/config.toml` configuration:

```toml
[mcp_servers.jam_dashboard]
url = "http://127.0.0.1:4177/mcp"
bearer_token_env_var = "JAM_DASHBOARD_MCP_TOKEN"
```

A GUI agent must inherit that environment variable when it starts; an export in an unrelated terminal will not update an already running GUI process. If environment setup is inconvenient, Codex also supports `http_headers = { Authorization = "Bearer YOUR_TOKEN" }` instead of `bearer_token_env_var` in its private configuration. Keep tokens out of committed project files. See [Codex MCP configuration](https://developers.openai.com/codex/mcp).

For Cursor, **Copy Cursor MCP config** provides the following format for its MCP settings. Use `4178` and the web MCP connection panel’s token when targeting Chrome. See [Cursor MCP configuration](https://cursor.com/docs/mcp).

```json
{
  "mcpServers": {
    "jam-dashboard": {
      "url": "http://127.0.0.1:4177/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

MCP clients use Streamable HTTP. The official SDK serves both the 2025 initialization protocol and the 2026 discovery protocol. This is bearer-token authentication, not OAuth: no MCP login flow is necessary.

## Try it

Ask the connected agent:

> Select C major in Jam Dashboard. Identify the chord E, G, C, using E as the bass. Show four C/E voicings, then display the second one.

The underlying calls are:

```json
{"tool":"set_view","arguments":{"scale":"C major"}}
{"tool":"identify_chord","arguments":{"notes":["E","G","C"]}}
{"tool":"show_voicings","arguments":{"chord":"C/E","options":{"limit":4}}}
{"tool":"select_voicing","arguments":{"index":1}}
```

Other examples:

```json
{"tool":"set_view","arguments":{"scale":"G major","settings":{"cagedModeEnabled":true,"cagedShape":"C"}}}
{"tool":"show_fretboard","arguments":{"scale":"Db major","notes":["Db","F","Ab"]}}
{"tool":"show_fretboard","arguments":{"scale":"C major","positions":[{"string":1,"fret":0},{"string":2,"fret":1},{"string":3,"fret":0}]}}
{"tool":"show_fretboard","arguments":{}}
```

The last call returns to the normal scale view. Visualization calls return the committed state of the live app. They do not play audio or produce an image inside the agent's chat.

## Tool contract

| Tool                   | Purpose                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `get_capabilities`     | V1 rules, limits and suggested workflow.                                                                          |
| `list_sessions`        | Connected views, their IDs, platform, revision and readiness.                                                     |
| `get_state`            | Selected scale, tuning, settings, highlights, exact positions and current voicing result.                         |
| `identify_chord`       | Tonal candidates from ordered notes; first note is bass even when octave labels are supplied.                     |
| `get_chord`            | Chord notes, intervals, quality and optional slash bass.                                                          |
| `get_scale`            | Scale notes, intervals and the existing pentatonic mapping.                                                       |
| `find_voicings`        | Pure, bounded guitar voicing search. Does not need a connected view.                                              |
| `set_view`             | Select scale, tuning or display settings atomically.                                                              |
| `show_fretboard`       | Show notes, a chord, or exact positions; omit all three to clear the selection.                                   |
| `show_voicings`        | Search, show the first result and expose the result selector.                                                     |
| `select_voicing`       | Select a zero-based index from the current results.                                                               |
| `analyze_song`         | Desktop: search by song name and artist or use a direct YouTube URL, download an MP3, and start BPM/key analysis. |
| `get_song_analysis`    | Desktop: read the current job or a retained job by ID, including progress, matched video, and analysis.           |
| `cancel_song_analysis` | Desktop: cancel the active job using its exact ID.                                                                |

Tool-handler results use `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code": ..., "message": ... } }`; MCP also sets `isError`. SDK argument-validation failures can return text-only errors without `structuredContent`; protocol and authentication failures may use MCP or HTTP errors. All tools have JSON input/output schemas and annotations. Unknown arguments are rejected.

View tools accept `sessionId` where relevant. It is optional with one connected view and required with multiple views. View mutations also accept `expectedRevision` for optimistic concurrency. Refresh with `get_state` after `REVISION_CONFLICT`. Human changes publish the same state that tools read. Commands are acknowledged after React commits, with bounded duplicate-request protection. On `ACK_TIMEOUT`, the command may have applied: read the state before retrying. A reload creates a new session ID; rediscover it with `list_sessions`. Song-analysis tools act on the desktop host and do not accept `sessionId` or `expectedRevision`.

Notes are compared enharmonically and displayed using the scale's spelling. Out-of-scale requests return `NOTES_OUTSIDE_SCALE` without changing the view. Explicitly choose a compatible scale to proceed. Clearing the scale in the normal UI produces `SCALE_REQUIRED`. `show_fretboard` accepts only one of `notes`, `chord` and `positions`.

String 1 is the top/high string. Tuning arrays and voicing fret arrays run **high to low**, independent of handedness. Fret 0 means open; `null` in a voicing means muted. Exact positions may include several frets on one string for diagrams. A generated voicing has at most one sounding position per string. View settings support 4–8 strings and up to 24 frets; tuning changes invalidate previous exact selections.

CAGED tools use the existing scale-coloring implementation, with C/A/G/E/D/ALL. They do not generate positional CAGED chord templates. CAGED requires an existing pentatonic mapping. A note/voicing selection disables CAGED coloring so the displayed selection is unambiguous.

## Song analysis

Connect to the **desktop endpoint** and ask:

> Find the key and BPM of Blue Skies by Ella Fitzgerald. Then show the detected key on my fretboard.

Check `get_capabilities` for `songAnalysis.available`. The desktop host supports analysis using the same installed yt-dlp, ffmpeg, native helper, and destination folder as the YouTube Analyzer tab. Standalone Chrome and native WebMCP publish the tool definitions but return `ANALYZER_UNAVAILABLE`; connect to the desktop endpoint to use them.

The agent starts an asynchronous job and polls its returned ID:

```json
{"tool":"analyze_song","arguments":{"query":"Blue Skies Ella Fitzgerald"}}
{"tool":"get_song_analysis","arguments":{"jobId":"RETURNED_JOB_ID"}}
```

`query` also accepts a direct YouTube URL. Song-name searches use the first YouTube match; the snapshot exposes the matched title, channel, duration, and URL so the agent can identify the recording. A successful start selects the analyzer tab in an open dashboard window without clearing fretboard highlights. It saves an MP3 to the app's existing destination and analyzes the downloaded audio locally. It does not change the selected key automatically.

`analyze_song` returns immediately with a public snapshot: `jobId`, `status`, `query`, `source`, `analysis`, and `error`. Snapshots omit destination and file-path fields. Poll `get_song_analysis` every few seconds until `complete`, `error`, or `cancelled`; omitting `jobId` reads the current job. Read the current job before retrying an uncertain start. Key and tempo are estimates, with confidence values, and the key can be unknown. If the user asks to apply a detected key, call `set_view` with `scale` set to the non-null `analysis.keyScale`. That follow-up uses the normal view/session rules.

Human and agent starts share a single analyzer slot. A new start while searching, downloading, or analyzing returns a busy error without replacing the job. To cancel, call `cancel_song_analysis` with the exact `jobId`; it cannot cancel a different, newer job. The latest eight terminal snapshots remain queryable in memory until the desktop app restarts. Local-file jobs started in the UI share the same slot and have a null query. The normal UI also shows progress and permits cancellation; completed audio remains accessible from the app's Finder action.

## Basic voicing module

`shared/music/voicings.ts` is independent of React, Electron and MCP. Algorithm version 1 supports:

- Six-string E standard: `E4, B3, G3, D3, A2, E2`.
- Inclusive fret range 0–12 by default, configurable through `minFret` / `maxFret` up to 24.
- All distinct chord tones required, with duplicated tones, open strings and muted strings allowed.
- Maximum fretted span 4 by default (`maxSpan`, at most 5); open strings do not count toward the span.
- All inversions for plain chords; slash bass enforced using actual sounding MIDI pitches.
- At most 20 results (`limit`) and 100,000 search nodes. Deterministic enumeration; no fingering or ergonomic ranking.

Results include the constraints, `complete`, `truncated`, `stopReason`, node budget, algorithm version and exact positions. A limited batch is never described as every possible voicing. `find_voicings` can return an empty result. `show_voicings` leaves the view unchanged when there is nothing to show. Alternate tunings are supported for scale diagrams; voicing display reports `UNSUPPORTED_TUNING` until this module is extended. The agent must explicitly switch to standard tuning if desired.

## Architecture and local access

- `shared/music/`: validated Tonal queries and the replaceable voicing search.
- `shared/agent/`: tool registry, schemas, state/command contract and pure command validation.
- `app/contexts/AgentContext.tsx`: facade over existing React contexts, lifted tuning and exact-selection state, committed-state acknowledgments.
- `server/agent/`: shared MCP service, session registry and private token storage.
- `app/agent/`: desktop IPC, browser WebSocket and optional native WebMCP adapters.
- `desktop/main.cjs` / `preload.cjs`: service lifecycle and trusted-frame IPC. `agent:build` bundles the service into `desktop/agent-service.cjs`, which the installer includes.

The MCP service binds only to `127.0.0.1`, validates Host/Origin, requires a bearer token and bounds request bodies. Browser connections allow only the exact local app origin and authenticate in their first WebSocket message. Credentials are never put in URLs. The web launcher supplies connection information through a same-origin, no-store development endpoint; it is absent from ordinary and production builds. Desktop preserves sandboxing, context isolation and its existing renderer CSP.

The local agent web mode disables PostHog, ads, analytics and feedback recording, as desktop already does. Tokens are private files (mode `0600`): `.cache/jam-agent-token` for web, and `agent-token` in Electron's user-data directory for desktop. To revoke a token, stop that host, move/delete its token file, restart and update your agent configuration. Do not share the token with an untrusted local process.

Native Chrome WebMCP is an optional feature-detected adapter over the same definitions. It is available only when Chrome exposes `document.modelContext` (see [Chrome's setup and imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)). It controls `current-tab` directly. Standard MCP works without the browser flag, extension or WebMCP support. Native WebMCP registration is unit tested; a browser with that experimental API enabled was not available for live verification.

## Verification and troubleshooting

```sh
npm run typecheck
npm test -- --runInBand
npm run agent:test
npm run desktop:test
npm run build
npm run desktop:build
```

The MCP integration tests use real loopback sockets and the official client in both protocol modes. Tests cover auth, state acknowledgments, explicit session selection, disconnects/timeouts, exact voicing rendering, revisions, enharmonic validation, duplicate delivery and an exhaustive reference search on a small fretboard. Real Chrome and Electron runs additionally verify that MCP changes the visible board and observes manual selection.

The repository-wide lint command still reports four pre-existing errors in `Sidebar.tsx`, `ui/command.tsx`, `pitchDetection.test.ts` and `stories/Button.tsx`; the agent implementation introduces no lint errors. The existing Storybook type errors were fixed so the full TypeScript check passes.

- **No connected session:** open the dashboard, open Agent chat, choose MCP connection, and connect this view. Theory tools still work without it.
- **Port in use:** close the other service before opening desktop; for web choose `JAM_MCP_PORT=...` / `JAM_WEB_PORT=...`. Services never silently attach to a different app.
- **401 Unauthorized:** the header must be `Authorization: Bearer YOUR_TOKEN`, including the `Bearer ` prefix and space. Use the token belonging to the endpoint you configured; desktop and web tokens are different. After correcting saved credentials, reload the MCP connection or restart your agent.
- **Web connection rejected:** use the exact `127.0.0.1` web address printed by `agent:dev`; restart and reconnect after changing a token.
- **View not ready:** return to the dashboard route that contains the fretboard.
- **No voicings or search truncated:** adjust the fret range/span or use a simpler chord. This first solver requires every chord tone and does not assign fingers.
- **Analyzer unavailable:** use the desktop MCP endpoint; the standalone web host cannot download or analyze songs.
- **Analyzer busy:** read the current job with `get_song_analysis`, then wait or cancel that exact job before starting another.
- **Song analysis failed:** inspect the job's `error` and confirm yt-dlp and ffmpeg are installed. Search, download, and native analysis failures appear in the same job snapshot shown by the app.

Public-site pairing, remote hosting, audio playback control, agent access to local-file pickers, alternate-tuning voicings, image export and multi-board comparison are deferred.
