import { registerWebMcp, type ModelContext } from './webmcp';
import { initialState } from '../../shared/agent/fixtures';
import { prepareCommand } from '../../shared/agent/commands';
test('registers shared schemas in Chrome, restricts the target and unregisters on cleanup', async () => {
  const registered: Parameters<ModelContext['registerTool']>[] = [];
  const registration = registerWebMcp(
    {
      read: initialState,
      subscribe: () => () => {},
      execute: async cmd => prepareCommand(initialState(), cmd),
    },
    {
      registerTool: (tool, options) => {
        registered.push([tool, options]);
      },
    },
  );
  await registration.ready;
  expect(registered).toHaveLength(14);
  const show = registered.find(([tool]) => tool.name === 'show_fretboard')![0];
  expect(JSON.parse(await show.execute({ chord: 'C' }))).toMatchObject({
    ok: true,
    data: { highlightNotes: ['C', 'E', 'G'] },
  });
  expect(
    JSON.parse(await show.execute({ chord: 'C', sessionId: 'another-tab' })),
  ).toMatchObject({ ok: false, error: { code: 'SESSION_DISCONNECTED' } });
  registration.dispose();
  expect(registered.every(([, options]) => options.signal.aborted)).toBe(true);
});

test('Chrome advertises desktop-only analysis without gaining native access', async () => {
  const registered: Parameters<ModelContext['registerTool']>[0][] = [];
  const execute = jest.fn(async cmd => prepareCommand(initialState(), cmd));
  const registration = registerWebMcp(
    {
      read: initialState,
      subscribe: () => () => {},
      execute,
    },
    {
      registerTool: tool => {
        registered.push(tool);
      },
    },
  );
  await registration.ready;
  try {
    const capabilities = registered.find(
      tool => tool.name === 'get_capabilities',
    )!;
    expect(JSON.parse(await capabilities.execute({}))).toMatchObject({
      ok: true,
      data: { songAnalysis: { available: false, desktopOnly: true } },
    });
    const analyze = registered.find(tool => tool.name === 'analyze_song')!;
    const get = registered.find(tool => tool.name === 'get_song_analysis')!;
    const cancel = registered.find(
      tool => tool.name === 'cancel_song_analysis',
    )!;
    expect(analyze.annotations).toEqual({
      readOnlyHint: false,
      consequentialHint: true,
      untrustedContentHint: true,
    });
    expect(get.annotations).toEqual({
      readOnlyHint: true,
      consequentialHint: false,
      untrustedContentHint: true,
    });
    for (const [tool, input] of [
      [analyze, { query: 'Blue Skies Ella Fitzgerald' }],
      [get, {}],
      [cancel, { jobId: 'e180b129-51ef-40de-90f5-a5bf6c566702' }],
    ] as const) {
      expect(JSON.parse(await tool.execute(input))).toMatchObject({
        ok: false,
        error: { code: 'ANALYZER_UNAVAILABLE' },
      });
    }
    expect(execute).not.toHaveBeenCalled();
  } finally {
    registration.dispose();
  }
});

test('asynchronous registration failure aborts partial registration', async () => {
  let signal: AbortSignal | undefined;
  const registration = registerWebMcp(
    {
      read: initialState,
      subscribe: () => () => {},
      execute: async cmd => prepareCommand(initialState(), cmd),
    },
    {
      registerTool: async (_tool, options) => {
        signal = options.signal;
        throw new Error('Unavailable');
      },
    },
  );
  await expect(registration.ready).rejects.toThrow('Unavailable');
  expect(signal?.aborted).toBe(true);
});
