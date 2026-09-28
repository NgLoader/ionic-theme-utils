#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

const root = resolve(process.argv[2] ?? process.cwd());
const ts = createRequire(join(root, 'package.json'))('typescript');
const temporary = mkdtempSync(join(tmpdir(), 'ionic-theme-esm-'));

try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' }),
  );
  execFileSync('tar', ['-xzf', join(temporary, packed[0].filename), '-C', temporary]);
  const directory = join(temporary, 'package');
  const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  assert.equal(manifest.type, 'module');

  // Check declarations and lazy imports as well as the public JavaScript graph.
  for (const relative of readdirSync(join(directory, 'dist'), { recursive: true }).filter(
    (file) => file.endsWith('.js') || file.endsWith('.d.ts'),
  )) {
    const file = join(directory, 'dist', relative);
    const declaration = relative.endsWith('.d.ts');
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
              ? node.argument.literal
              : undefined;
      // The root is Ionic lazy-loader build. Bundlers then emit every component as a chunk, and apps get a second gesture controller.
      if (specifier && ts.isStringLiteral(specifier) && !declaration) {
        assert.notEqual(specifier.text, '@ionic/core', `${relative}: import from @ionic/core/components instead of @ionic/core`);
      }
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
        assert.ok(specifier.text.endsWith('.js'), `${relative}: missing .js extension in ${specifier.text}`);
        const target = declaration ? specifier.text.replace(/\.js$/, '.d.ts') : specifier.text;
        assert.ok(statSync(resolve(dirname(file), target)).isFile(), `${relative}: invalid target ${specifier.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  // Reuse installed dependencies, but resolve the theme itself from its tarball.
  symlinkSync(join(root, 'node_modules'), join(temporary, 'node_modules'), 'dir');
  const entries = Object.entries(manifest.exports)
    .filter(([, target]) => typeof target === 'object' && typeof target.import === 'string')
    .map(([subpath]) => manifest.name + subpath.slice(1));
  assert.ok(entries.length > 0, 'No public ESM entry points found');
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `for (const name of ${JSON.stringify(entries)}) { await import(name); process.stdout.write('Imported ' + name + '\\n'); }`,
    ],
    { cwd: directory, stdio: 'inherit' },
  );
  process.stdout.write('Packed ESM imports and relative specifiers verified.\n');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
