import process from 'node:process';

export default {
  cwd: process.cwd(),
  entry: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/**/*.test.ts', '!src/**/*.d.ts'],
  root: 'src',
  outDir: 'dist',
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  unbundle: true,
  // CSS is built into dist/css before the JavaScript build in theme packages.
  clean: false,
  dts: { sourcemap: true },
  deps: { neverBundle: true },
};
