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
  expect(registered).toHaveLength(11);
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
