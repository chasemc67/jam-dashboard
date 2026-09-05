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

export default defineConfig({
  define: {
    'import.meta.env.JAM_DESKTOP': JSON.stringify(isDesktop),
  },
  plugins: [
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
