# @rdlabo/ionic-theme-utils

Shared, theme-neutral utilities for Rdlabo Ionic themes.

Install the published package from npm. JavaScript and type declarations are
built before publication; Sass sources are included for theme builds.

```shell
npm install @rdlabo/ionic-theme-utils
```

```typescript
import { createIosTransitionAnimation, getPopoverPosition } from '@rdlabo/ionic-theme-utils';
```

```scss
@use 'pkg:@rdlabo/ionic-theme-utils/styles/structured-list';
```

The package currently contains shared iOS transition construction, popover
positioning, searchable tab-bar utilities, and structured-list Sass mixins.

## Development

### Check a theme's ESM package

This package provides `rdlabo-check-esm` for the iOS 26, iOS 27, and MD3 themes.
Add it to the consuming theme's npm scripts:

```json
{
  "scripts": {
    "test:esm": "rdlabo-check-esm"
  }
}
```

Run `npm run build && npm run test:esm` from the theme's root directory. An
explicit package directory can also be passed as the first argument. The command
requires Node.js 24 or later, npm, tar, and TypeScript installed in the target
package's development dependencies.

The check creates and extracts an npm tarball without running lifecycle scripts,
requires `"type": "module"`, verifies explicit `.js` extensions and existing file
targets for relative imports in `dist/` (including literal dynamic imports), and
loads each public JavaScript entry point declared by an `exports` entry with an
`import` target. It supports the themes' explicit entry points; wildcard exports
and nested conditions are not supported. Installed dependencies are reused, while
the theme itself is loaded from the tarball. UI operations are not executed.

TypeScript is loaded from the package being checked, so the CLI does not add it
as a runtime dependency of the shared utilities.

### Work on the shared utilities

```shell
npm install
npm run build
npm run lint
```

Use `npm link` while developing this package together with a theme repository.
Theme repositories should depend on a published npm version. Stable releases use
the `latest` dist-tag, prereleases use `next`, and PR candidates use `beta`.

Run `npm run release` on `main` to select the next SemVer version and push its
`utils-v*` tag. GitHub Actions publishes the matching package version.
