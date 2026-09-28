#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const root = resolve(process.argv[2] ?? process.cwd());
const require = createRequire(join(root, 'package.json'));
const result = spawnSync(
  process.execPath,
  [require.resolve('tsdown/run'), '--config', fileURLToPath(new URL('./theme-build.config.mjs', import.meta.url))],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
