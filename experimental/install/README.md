# Experimental Install Check

This check validates the packed-package installation path for `ttsc`.

It builds local `.tgz` packages, installs them into a temporary npm project, and
verifies that:

- `ttsc` installs from a tarball;
- the current platform-specific `@ttsc/*` package tarball is installed;
- `ttsc` resolves its native binary from the platform package, not a local
  workspace fallback;
- an installed consumer project loads a local `compilerOptions.plugins`
  transformer;
- `ttsc --version`, `ttsc --emit`, and `ttsx` execute through the installed
  package path and observe the transformed output.

Run:

```bash
npm run start
```

To reuse already-built tarballs:

```bash
npm run start -- --skip-pack
```

To pack only `ttsc` and the current platform package before running the
same check:

```bash
npm run start -- --pack-current
```
