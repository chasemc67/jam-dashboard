import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  GATEWAY_KEY_INVALID_MESSAGE,
  GATEWAY_KEYCHAIN_ACCOUNT,
  GATEWAY_KEYCHAIN_SERVICE,
  type GatewayKeyStatus,
} from '~/agent/gateway-key';
import GatewayKeySetup from './GatewayKeySetup';

const key = `vck_${'K9j8H7g6'.repeat(6)}`;
const missing: GatewayKeyStatus = {
  configured: false,
  source: null,
  service: GATEWAY_KEYCHAIN_SERVICE,
  account: GATEWAY_KEYCHAIN_ACCOUNT,
};
const saved: GatewayKeyStatus = {
  ...missing,
  configured: true,
  source: 'keychain',
};

function renderSetup(
  props: Partial<Parameters<typeof GatewayKeySetup>[0]> = {},
) {
  const onSave = jest.fn(async () => ({ ok: true as const, status: saved }));
  const onClear = jest.fn(async () => ({ ok: true as const, status: missing }));
  render(
    <GatewayKeySetup
      titleId="title"
      descriptionId="description"
      status={missing}
      onSave={onSave}
      onClear={onClear}
      onClose={jest.fn()}
      {...props}
    />,
  );
  return { onSave, onClear };
}

test('walks through getting a key and names the Keychain item', () => {
  renderSetup();
  expect(
    screen.getByRole('heading', { name: 'Add your AI Gateway key' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Open AI Gateway keys/ }),
  ).toHaveAttribute('href', expect.stringContaining('ai-gateway'));
  expect(screen.getByText(/service “Jam Dashboard”/)).toHaveTextContent(
    'account “AI_GATEWAY_API_KEY”',
  );
  expect(
    screen.queryByRole('button', { name: 'Remove key from Keychain' }),
  ).not.toBeInTheDocument();
});

test('saves a trimmed key, then clears the field', async () => {
  const { onSave } = renderSetup();
  const input = screen.getByLabelText('AI Gateway API key');
  expect(input).toHaveAttribute('type', 'password');
  fireEvent.change(input, { target: { value: `  ${key}  ` } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(key));
  expect(input).toHaveValue('');
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Key saved to Keychain',
  );
});

test('validates before saving and shows save errors', async () => {
  const onSave = jest.fn(async () => ({
    ok: false as const,
    error: 'Keychain could not save the key: denied.',
    status: missing,
  }));
  renderSetup({ onSave });
  const input = screen.getByLabelText('AI Gateway API key');
  fireEvent.change(input, { target: { value: 'not a key' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    GATEWAY_KEY_INVALID_MESSAGE,
  );
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: key } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Keychain could not save the key: denied.',
  );
});

test('replaces or removes a saved key and returns to chat', async () => {
  const onBack = jest.fn();
  const { onClear } = renderSetup({ status: saved, onBack });
  expect(
    screen.getByRole('heading', { name: 'AI Gateway key' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Replace' })).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove key from Keychain' }),
  );
  await waitFor(() => expect(onClear).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('explains an environment override and shows notices', () => {
  renderSetup({
    status: { ...saved, source: 'environment' },
    notice: 'The AI Gateway rejected your API key.',
  });
  expect(screen.getByText(/from the environment/)).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('rejected');
  expect(
    screen.queryByRole('button', { name: 'Remove key from Keychain' }),
  ).not.toBeInTheDocument();
});
