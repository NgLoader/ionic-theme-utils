import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { after, test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'theme-esm-cli-test-'));
after(() => rmSync(temporary, { recursive: true, force: true }));

// Run the published CLI without the utils repository's development dependencies.
const [archive] = JSON.parse(
  execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' }),
);
execFileSync('tar', ['-xzf', join(temporary, archive.filename), '-C', temporary]);
const manifest = JSON.parse(readFileSync(join(temporary, 'package/package.json'), 'utf8'));
const cli = join(temporary, 'package', manifest.bin['rdlabo-check-esm']);

const fixture = (name, { type = 'module', lazy = './detail.js', native = 'export const native = true;', files = ['dist'] } = {}) => {
  const directory = join(temporary, name);
  mkdirSync(join(directory, 'dist'), { recursive: true });
  mkdirSync(join(directory, 'node_modules'), { recursive: true });
  const require = createRequire(import.meta.url);
  symlinkSync(dirname(require.resolve('typescript/package.json')), join(directory, 'node_modules/typescript'), 'dir');
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({
      name: `theme-${name}`,
      version: '1.0.0',
      type,
      files,
      exports: { '.': { import: './dist/index.js' }, './native': { import: './dist/native.js' } },
      scripts: { prepack: 'exit 1', prepare: 'exit 1' },
    }),
  );
  writeFileSync(join(directory, 'dist/index.js'), "export { value } from './detail.js';");
  writeFileSync(join(directory, 'dist/detail.js'), 'export const value = 1;');
  writeFileSync(join(directory, 'dist/native.js'), native);
  writeFileSync(join(directory, 'dist/lazy.js'), `export const load = () => import(${JSON.stringify(lazy)});`);
  return directory;
};

const run = (directory, explicit = false) => {
  const result = spawnSync(process.execPath, [cli, ...(explicit ? [directory] : [])], {
    cwd: explicit ? temporary : directory,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ifError(result.error);
  return { ...result, output: result.stdout + result.stderr };
};

test('checks the consuming package from cwd or an explicit directory, without running lifecycle scripts', () => {
  const directory = fixture('valid');
  for (const explicit of [false, true]) {
    const result = run(directory, explicit);
    assert.equal(result.status, 0, result.output);
    assert.match(result.stdout, /Imported theme-valid\nImported theme-valid\/native\n/);
  }
});

test('rejects extensionless lazy imports even outside the public import graph', () => {
  const result = run(fixture('extensionless', { lazy: './detail' }));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /missing \.js extension in \.\/detail/);
});

test('rejects files omitted from the npm tarball', () => {
  const result = run(fixture('missing-target', { files: ['dist/index.js', 'dist/native.js'] }));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /ENOENT.*detail\.js/);
});

test('requires an explicit ESM package declaration', () => {
  const result = run(fixture('commonjs', { type: 'commonjs' }));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /commonjs/);
});

test('imports subpath entry points and catches import-time DOM access', () => {
  const result = run(fixture('dom-access', { native: 'export const body = document.body;' }));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /document is not defined/);
});
