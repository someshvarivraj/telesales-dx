import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/cli/createUser.ts', 'src/cli/importAreaTable.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Bundle workspace packages so the deployed artifact does not depend on TS sources.
  noExternal: ['@telesales/shared'],
});
