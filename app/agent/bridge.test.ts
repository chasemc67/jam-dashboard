import {
  executeRequest,
  connectDesktop,
  requestHandler,
  type DesktopAgentAPI,
} from './bridge';
import type {
  AppController,
  CommandRequest,
  CommandReply,
} from '../../shared/agent/contract';
import { initialState } from '../../shared/agent/fixtures';
import { prepareCommand } from '../../shared/agent/commands';

test('desktop adapter uses the same commands, replies and cleanup contract', async () => {
  const controller: AppController = {
    read: initialState,
    subscribe: jest.fn(() => jest.fn()),
    execute: jest.fn(async command => prepareCommand(initialState(), command)),
  };
  let onCommand!: (request: CommandRequest) => void;
  const replies: CommandReply[] = [];
  const api: DesktopAgentAPI = {
    copyConfiguration: jest.fn(async () => {}),
    getConnection: jest.fn(),
    connect: jest.fn(async () => 'desktop-session'),
    disconnect: jest.fn(async () => {}),
    publish: jest.fn(async () => {}),
    reply: jest.fn(async (_id, reply) => {
      replies.push(reply);
    }),
    onCommand: callback => {
      onCommand = callback;
      return jest.fn();
    },
  };
  const report = jest.fn();
  const cleanup = connectDesktop(controller, api, report);
  await Promise.resolve();
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ connected: true }),
  );
  onCommand({
    id: 'command-1',
    command: { type: 'show_fretboard', input: { chord: 'C' } },
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(replies[0].state?.highlightNotes).toEqual(['C', 'E', 'G']);
  cleanup();
  expect(api.disconnect).toHaveBeenCalledWith('desktop-session');
  expect(
    await executeRequest(controller, {
      id: 'bad',
      command: { type: 'select_voicing', input: { index: 100 } },
    }),
  ).toMatchObject({ error: { code: 'INVALID_INPUT' } });
});

test('duplicate deliveries return the original result without applying again', async () => {
  const execute = jest.fn(async command =>
    prepareCommand(initialState(), command),
  );
  const handle = requestHandler({
    read: initialState,
    subscribe: () => () => {},
    execute,
  });
  const request: CommandRequest = {
    id: 'same',
    command: { type: 'show_fretboard', input: { chord: 'C' } },
  };
  expect(await handle(request)).toEqual(await handle(request));
  expect(execute).toHaveBeenCalledTimes(1);
  expect(
    await handle({ ...request, command: { type: 'set_view', input: {} } }),
  ).toMatchObject({ error: { code: 'REQUEST_ID_REUSED' } });
});
