import { chatErrorMessage, describeChatPart } from './chat-ui';

test('describeChatPart renders text and brief tool indicators', () => {
  expect(describeChatPart({ type: 'text', text: 'Hello' })).toEqual({
    kind: 'text',
    text: 'Hello',
  });
  expect(
    describeChatPart({ type: 'tool-set_view', state: 'input-available' }),
  ).toEqual({ kind: 'tool', label: 'Using set_view…' });
  expect(
    describeChatPart({
      type: 'tool-show_fretboard',
      state: 'output-available',
    }),
  ).toEqual({ kind: 'tool', label: 'Used show_fretboard' });
  expect(
    describeChatPart({
      type: 'dynamic-tool',
      toolName: 'get_state',
      state: 'output-available',
    }),
  ).toEqual({ kind: 'tool', label: 'Used get_state' });
});

test('chatErrorMessage reads plain text and JSON error bodies', () => {
  expect(chatErrorMessage(new Error('{"error":"Nope"}'))).toBe('Nope');
  expect(chatErrorMessage(new Error(MCP_TEXT))).toBe(MCP_TEXT);
});

const MCP_TEXT = 'Start with npm run agent:dev';
