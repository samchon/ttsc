# Experimental Install Check

This check validates the packed-package installation path for `ttsc`.

It builds local `.tgz` packages, installs them into a temporary npm project, and
verifies that:

- `ttsc` installs from a tarball;
- the current platform-specific `@ttsc/*` package tarball is installed;
- `ttsc` resolves its native binary from the platform package, not a local
  workspace fallback;
- the platform package includes the bundled Go compiler used for source
  plugin builds;
- `@ttsc/banner`, `@ttsc/paths`, and `@ttsc/strip` build from source with
  that bundled Go compiler;
- `@ttsc/unplugin` installs from its tarball, exposes every adapter entrypoint
  through ESM default import and CJS require, and runs inside a real Vite build;
- `@ttsc/lint` and `@ttsc/unplugin` do not publish their local
  `tsconfig.json` files;
- `ttsc --version`, `ttsc --emit`, and `ttsx` execute through the installed
  package path and observe the emitted JavaScript, declarations, source maps,
  path rewrites, stripped statements, and runtime output.

Run:

```bash
npm run start
```

To reuse already-built tarballs:

```bash
npm run start -- --skip-pack
```

To pack only `ttsc`, the first-party utility plugins, and the current platform
package before running the same check:

```bash
npm run start -- --pack-current
```
