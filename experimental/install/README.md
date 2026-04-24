# Experimental Install Check

This check validates the packed-package installation path for `ttsc` and `ttsx`.

It builds local `.tgz` packages, installs them into a temporary npm project, and
verifies that:

- `ttsc` and `ttsx` install from tarballs;
- the current platform-specific `@ttsc/*` package tarball is installed;
- `ttsc` resolves its native binary from the platform package, not a local
  workspace fallback;
- `ttsc --version`, `ttsc --emit`, and `ttsx` execute through the installed
  package path.

Run:

```bash
npm run start
```

To reuse already-built tarballs:

```bash
npm run start -- --skip-pack
```

To pack only `ttsc`, `ttsx`, and the current platform package before running the
same check:

```bash
npm run start -- --pack-current
```
