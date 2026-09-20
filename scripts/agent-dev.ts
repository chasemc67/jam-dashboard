import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { startAgentService } from '../server/agent/service';
import { loadAgentToken } from '../server/agent/token';

const webPort = Number(process.env.JAM_WEB_PORT ?? 5173);
const mcpPort = Number(process.env.JAM_MCP_PORT ?? 4178);
for (const port of [webPort, mcpPort])
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Ports must be integers between 1024 and 65535.');
const token = await loadAgentToken(resolve('.cache/jam-agent-token'));
const service = await startAgentService({
  token,
  port: mcpPort,
  browserOrigins: [`http://127.0.0.1:${webPort}`],
});
const child = spawn(
  process.execPath,
  [
    'node_modules/@remix-run/dev/dist/cli.js',
    'vite:dev',
    '--host',
    '127.0.0.1',
    '--port',
    String(webPort),
    '--strictPort',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      JAM_AGENT: 'true',
      JAM_AGENT_TOKEN: token,
      JAM_AGENT_URL: service.url,
      JAM_WEB_PORT: String(webPort),
    },
  },
);
console.log(
  `Jam Dashboard: http://127.0.0.1:${webPort}\nMCP: ${service.url}\nOpen “AI connection” in the app for credentials and setup.\n`,
);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill('SIGTERM');
  await service.close();
  process.exitCode = code;
}
child.on('exit', code => {
  void stop(code ?? 0);
});
child.on('error', error => {
  console.error(error.message);
  void stop(1);
});
process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
