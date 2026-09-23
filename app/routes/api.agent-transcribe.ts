import type { ActionFunctionArgs } from '@remix-run/node';
import { handleAgentTranscribeRequest } from '~/agent/voice.server';

export function loader() {
  return new Response('Method not allowed', { status: 405 });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  return handleAgentTranscribeRequest(request);
}
