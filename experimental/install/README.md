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
- `@ttsc/banner` builds from source with that bundled Go compiler;
- `ttsc --version`, `ttsc --emit`, and `ttsx` execute through the installed
  package path and observe the emitted output.

Run:

```bash
npm run start
```

To reuse already-built tarballs:

```bash
npm run start -- --skip-pack
```

To pack only `ttsc`, `@ttsc/banner`, and the current platform package before
running the same check:

```bash
npm run start -- --pack-current
```
