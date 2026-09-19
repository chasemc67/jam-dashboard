import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

declare module '@remix-run/node' {
  interface Future {
    v3_singleFetch: true;
  }
}

const isStorybook = process.env.STORYBOOK === 'true';
const isDesktop = process.env.JAM_DESKTOP === 'true';
const isAgent = process.env.JAM_AGENT === 'true';

export default defineConfig({
  define: {
    'import.meta.env.JAM_DESKTOP': JSON.stringify(isDesktop),
    'import.meta.env.JAM_AGENT': JSON.stringify(isAgent),
  },
  plugins: [
    isAgent && {
      name: 'jam-local-agent-config',
      configureServer(server) {
        server.middlewares.use('/__jam-agent/config', (req, res) => {
          const origin = `http://127.0.0.1:${process.env.JAM_WEB_PORT ?? '5173'}`;
          if (
            req.method !== 'GET' ||
            req.headers.host !== new URL(origin).host ||
            (req.headers.origin && req.headers.origin !== origin) ||
            (req.headers['sec-fetch-site'] &&
              req.headers['sec-fetch-site'] !== 'same-origin')
          ) {
            res.writeHead(403).end();
            return;
          }
          if (!process.env.JAM_AGENT_TOKEN || !process.env.JAM_AGENT_URL) {
            res.writeHead(503).end();
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(
            JSON.stringify({
              connection: {
                url: process.env.JAM_AGENT_URL,
                token: process.env.JAM_AGENT_TOKEN,
              },
            }),
          );
        });
      },
    },
    !isStorybook &&
      remix({
        ...(isDesktop && { ssr: false, buildDirectory: 'desktop/renderer' }),
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_singleFetch: true,
          v3_lazyRouteDiscovery: !isDesktop,
        },
      }),
    tsconfigPaths(),
  ],
});
