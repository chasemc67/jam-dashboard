/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ['**/.*'],
  serverModuleFormat: 'esm',
  serverPlatform: 'node',
  publicPath: '/build/',
  serverBuildPath: 'build/server/index.js',
  assetsBuildDirectory: 'public/build',
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
  },
};
