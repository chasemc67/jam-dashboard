import {
  experimental_evaluate,
  gateway as defaultGateway,
  type createGateway,
} from 'ai';
import {
  GATEWAY_KEY_REJECTED_MESSAGE,
  GATEWAY_UNAVAILABLE_MESSAGE,
  hasAiGatewayCredentials,
  isGatewayKeyRejected,
} from './chat-config';
import {
  buildJevEvaluationRequest,
  JEV_FAILED_MESSAGE,
  JEV_MALFORMED_MESSAGE,
  JEV_MODEL,
  JEV_REQUEST_INVALID_MESSAGE,
  JEV_TIMEOUT_MESSAGE,
  JEV_TIMEOUT_MS,
  parseJevAnswers,
  parseJevRequestBody,
} from './jev';

type Env = Record<string, string | undefined>;
type Gateway = Pick<ReturnType<typeof createGateway>, 'evaluationModel'>;

type EvaluateCandidates = (args: {
  gateway: Gateway;
  request: ReturnType<typeof buildJevEvaluationRequest>;
  abortSignal: AbortSignal;
}) => Promise<{ answers: unknown }>;

const evaluateWithGateway: EvaluateCandidates = ({
  gateway,
  request,
  abortSignal,
}) =>
  experimental_evaluate({
    model: gateway.evaluationModel(JEV_MODEL),
    ...request,
    abortSignal,
    // One retry for 429/5xx, still bounded by the total deadline.
    maxRetries: 1,
    providerOptions: { gateway: { only: ['typesafe-ai'] } },
  });

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function jevErrorMessage(error: unknown) {
  if (isGatewayKeyRejected(error)) return GATEWAY_KEY_REJECTED_MESSAGE;
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (
    /AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN|unauthorized|401|403|api key/i.test(
      text,
    )
  ) {
    return GATEWAY_UNAVAILABLE_MESSAGE;
  }
  // SDK errors can embed request payloads (transcripts), so never echo them.
  return JEV_FAILED_MESSAGE;
}

/**
 * Classifies transcript suffixes as directed at the assistant or ambient.
 * Returns `{ decisions }`; every failure is an error response so callers hold
 * (fail closed) instead of submitting.
 */
export async function handleAgentJevRequest(
  request: Request,
  deps: {
    env?: Env;
    /** Omit to use the default AI Gateway provider configured from process env. */
    gateway?: Gateway;
    evaluate?: EvaluateCandidates;
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(JEV_REQUEST_INVALID_MESSAGE, 400);
  }
  const body = parseJevRequestBody(raw);
  if (!body) return jsonError(JEV_REQUEST_INVALID_MESSAGE, 400);

  const env = deps.env ?? process.env;
  if (!hasAiGatewayCredentials(env)) {
    return jsonError(GATEWAY_UNAVAILABLE_MESSAGE, 503);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? JEV_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  request.signal?.addEventListener('abort', onAbort, { once: true });
  if (request.signal?.aborted) controller.abort();

  try {
    const result = await (deps.evaluate ?? evaluateWithGateway)({
      gateway: deps.gateway ?? defaultGateway,
      request: buildJevEvaluationRequest(body),
      abortSignal: controller.signal,
    });
    if (timedOut) return jsonError(JEV_TIMEOUT_MESSAGE, 504);
    try {
      return Response.json({
        decisions: parseJevAnswers(body, result.answers),
      });
    } catch {
      return jsonError(JEV_MALFORMED_MESSAGE, 502);
    }
  } catch (error) {
    if (timedOut) return jsonError(JEV_TIMEOUT_MESSAGE, 504);
    const message = jevErrorMessage(error);
    return jsonError(message, message === JEV_FAILED_MESSAGE ? 502 : 503);
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', onAbort);
  }
}
