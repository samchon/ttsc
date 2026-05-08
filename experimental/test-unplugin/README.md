# @ttsc/unplugin experimental install test

This experiment installs packed `ttsc`, the current platform package, and `@ttsc/unplugin` into a clean consumer project.

It verifies the published package contract, ESM imports, CJS requires, and real builds for the supported Node-run bundlers. Bun is executed when the local `bun` runtime is available.

Run from the repository root:

```bash
pnpm run experimental:unplugin
```

To reuse already-built tarballs:

```bash
pnpm --dir experimental/test-unplugin start -- --skip-pack
```
