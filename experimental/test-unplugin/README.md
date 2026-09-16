# @ttsc/unplugin experimental install test

This experiment installs packed `ttsc`, the current platform package, and `@ttsc/unplugin` into a clean consumer project.

It verifies ESM and CJS entrypoints, production builds, and dependency updates in every supported host. Node, Go, and Bun must be available on PATH. CI pins Bun and every installed ecosystem version.

Run from the repository root:

```bash
pnpm run experimental:unplugin
```

To reuse already-built tarballs:

```bash
pnpm --dir experimental/test-unplugin start -- --skip-pack
```

The consumer installs once. Every scenario shares the same immutable Go plugin source and native build cache, while mutable projects remain separate. The contract checks transformed output and compilation counts instead of imposing machine-dependent speed thresholds. Successful asynchronous checks proceed on build events or observed state; deadlines only bound failures.

| Host | Direct contract |
| --- | --- |
| Vite 7 and 8 | Client/SSR dependency invalidation, runtime-import isolation, restart |
| React Router 8 | Its actual Vite plugin accepts erased `.server` type imports and refreshes their consumers |
| Rollup and Rolldown | Watch rebuilds after successive compiler-only edits |
| esbuild | Watch context, unchanged rebuild, disposal |
| webpack and Rspack | Module-owned dependency rebuilds, cache reuse, compiler shutdown and replacement |
| Farm | Native dependency registration and successive `Compiler.update` calls |
| Next.js | Production and development with both webpack and Turbopack |
| Bun | Repeated builds and fresh runtime preload sessions |

The installed package's export map must match this executable host inventory. Adding an adapter without a direct contract fails the rehearsal. Core graph/proof scenarios remain in `tests/test-unplugin`; its real Bun and Vite boundary cases also run in the Windows lane. Long-lived Next development CLIs run in owned process trees and are stopped after their HTTP assertions.
