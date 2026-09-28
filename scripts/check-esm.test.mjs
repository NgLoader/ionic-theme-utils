import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
const buildCli = join(temporary, 'package', manifest.bin['rdlabo-build-theme']);

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

test('rejects runtime imports from the @ionic/core root', () => {
  const result = run(fixture('ionic-root', { native: "export { createAnimation } from '@ionic/core';" }));
  assert.notEqual(result.status, 0);
  assert.match(result.output, /native\.js: import from @ionic\/core\/components instead of @ionic\/core/);
});

test('rejects extensionless references in declarations', () => {
  const directory = fixture('declaration');
  writeFileSync(join(directory, 'dist/index.d.ts'), "export type Value = import('./detail').Value;");
  const result = run(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /index\.d\.ts: missing \.js extension/);
});

test('builds extensionless sources and declarations with the packed shared CLI', () => {
  const directory = fixture('build');
  const require = createRequire(import.meta.url);
  symlinkSync(dirname(require.resolve('tsdown/package.json')), join(directory, 'node_modules/tsdown'), 'dir');
  mkdirSync(join(directory, 'src/nested'), { recursive: true });
  mkdirSync(join(directory, 'dist/css'), { recursive: true });
  writeFileSync(join(directory, 'dist/css/theme.css'), ':root { color: red; }');
  const source = "export { value } from './detail'; export type { Value } from './detail'; export const load = () => import('./nested');";
  writeFileSync(join(directory, 'src/index.ts'), source);
  writeFileSync(join(directory, 'src/detail.ts'), 'export type Value = number; export const value: Value = 42;');
  writeFileSync(join(directory, 'src/nested/index.ts'), 'export const nested = true;');
  writeFileSync(join(directory, 'src/native.ts'), 'export const native = true;');
  writeFileSync(join(directory, 'src/unused.spec.ts'), 'throw new Error("Tests must not be built");');
  writeFileSync(
    join(directory, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'bundler', strict: true } }),
  );
  const result = spawnSync(process.execPath, [buildCli, directory], { cwd: temporary, encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(directory, 'src/index.ts'), 'utf8'), source);
  assert.ok(existsSync(join(directory, 'dist/css/theme.css')));
  assert.ok(!existsSync(join(directory, 'dist/unused.spec.js')));
  assert.match(readFileSync(join(directory, 'dist/index.d.ts'), 'utf8'), /\.\/detail\.js/);
  const checked = run(directory);
  assert.equal(checked.status, 0, checked.output);
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "const m = await import('theme-build'); if (m.value !== 42 || !(await m.load()).nested) process.exit(1);",
    ],
    { cwd: directory },
  );
  writeFileSync(
    join(directory, 'consumer.mts'),
    "import { value, type Value } from 'theme-build'; const result: Value = value; void result;",
  );
  execFileSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '--noEmit', '--module', 'NodeNext', '--target', 'ES2020', 'consumer.mts'],
    { cwd: directory },
  );
});
