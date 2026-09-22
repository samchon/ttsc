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
| Vite 7 and 8 | Client/SSR dependency invalidation, runtime-import isolation, initial failure and rebuild recovery, restart |
| React Router 8 | Its actual Vite plugin accepts erased `.server` type imports, refreshes consumers and recovers from failed transforms |
| Rollup and Rolldown | Initial failure delivery, watch rebuilds and later failure/recovery through compiler-only edits |
| esbuild | Watch context, initial failure and rebuild recovery, unchanged rebuild, disposal |
| webpack and Rspack | Module-owned dependency rebuilds, initial failure and rebuild recovery, cache reuse, compiler shutdown and replacement |
| Farm | Native dependency registration, repeated failed/repaired `Compiler.update` calls, unchanged reuse, replacement after failed initial compilation |
| Next.js | Production and development with webpack and Turbopack, HTTP failure/recovery and unchanged requests |
| Bun | Repeated builds with failed/repaired inputs and fresh runtime preload sessions after an error |

Every host also runs the scenario matrix in `src/contracts/scenarios.mjs`: one list of edits, in one watching session, on a project named directly and on one named through a link, with two transform plugins. The source plugin (`assets/transform`) is a standalone Go process, whose envelope carries no compiler graph; the linked plugin (`assets/linked`) is a contributor to ttsc's utility host, whose compile goes through TypeScript-Go's program and whose envelope carries the compiler's verdict, graph, and resolution candidates. Scenarios whose observable is the compiler's verdict, a type error or a missing import, run with the linked plugin only. Rollup, webpack, and Rspack compile no TypeScript themselves, so their sessions strip types after ttsc with Node's own stripper, the stage a user adds.

A host with a persistent cache also runs the restart contract in `src/contracts/restarts.mjs`: each session in a process of its own over the host's cache, stopped, the project edited while nothing runs, and the next session started over the cache the last one stored. A restart over an unchanged project must compile nothing, and every offline edit, an input, the tsconfig, a root file, a dependency, an external input, must change what the next session serves. Hosts: webpack and Rspack over their filesystem caches, Farm over its persistent cache, Next with both compilers.

A failure names the project records the adapter handed the host: each record's signal, how many inputs it names, its modification time, and what `projectRecordMoved` finds left the recorded state. A scenario reports them as it began and as it failed, and a restart session reports them as the previous session left them, so an edit the adapter never heard is told apart from a move the host did not act on. The webpack and Next sessions also log each pass of each compiler with the records as it saw them, and the host's own verdict on every cached module it rebuilt.

In CI this rehearsal is the `unplugin hosts (<os>)` job, one per representative OS, on its own deadline: every host on two roots with two transform plugins and then the restart contract took 78 minutes of one macOS Intel runner, which is why it does not share a job with the watch, runtime, package-manager, source-map, and VS Code suites.

The installed package's export map must match this executable host inventory. Adding an adapter without a direct contract fails the rehearsal. Core graph/proof scenarios remain in `tests/test-unplugin`; its real Bun and Vite boundary cases also run in the Windows lane. Long-lived Next development CLIs run in owned process trees and are stopped after their HTTP assertions.

Rollup's initial-error check uses its one-shot API before reusing the plugin in a watcher. Its watch API emits the first error before its filesystem subscriptions are ready and can miss an immediate repair even with a plain native plugin. Later error/recovery transitions run through the live watcher. Farm's initial compilation failure requires a replacement compiler through its public API; incremental failures recover in the same compiler.
