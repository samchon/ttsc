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

Every host runs the complete scenario list in `src/contracts/scenarios.mjs` with the linked Go contributor, including host-specific races, compiler verdicts and recovery. This project uses a linked root wherever the host supports one. A second project uses the standalone source plugin and a direct root to verify its real connection, edits and failure/recovery. Rollup additionally runs the complete source-plugin list. These two projects cover both transports and root spellings without multiplying every common state transition by all four combinations. Compiler-input and project-record semantics run directly in `tests/test-unplugin/src/unit`; actual host watcher and predicate boundaries remain here.

A host with a persistent cache runs `src/contracts/restarts.mjs` against its actual stored cache. webpack retains all offline edit kinds as the complete consumer contract. Rspack, Farm and both Next compilers retain two unchanged restarts, a live config edit from a restored session and an offline input edit that invalidates the cache. The shared record proof independently checks config, extended-config, content, declarations, new dependencies, root membership and dependency renames in units. Every case is also observed through a real watcher in the complete linked-plugin scenarios. Every session of a host that cannot open a store cut short stops only once the stores it writes are committed: Farm rewrites every store's manifest after every compile that completes, whether that compile compiled a module or served them all from the cache, and panics on a half-written one when the next session starts, while a session whose compile failed writes none. A step that must be served from the cache waits for a store committed after the host's own last build, not merely after the session started: a host commits on an idle window of its own, and one that committed between its last two builds leaves the earlier build's module snapshots, which the next session rightly rebuilds. It waits first for the host to have run a pass that began after the record last moved, read where the adapter keeps it, below the root or in the fallback for a root it cannot write (`fallbackToolDirectory`): the adapter writes the record inside the build that produced it, so that build's snapshots predate it, and the host hears the write itself and runs one more pass whose snapshots begin after it. A session stopped inside that window stores a cache its successor rebuilds from, which is a session cut short rather than a cache that failed to serve.

A failure names the project records the adapter handed the host: each record's signal, how many inputs it names, its modification time, and what `projectRecordMoved` finds left the recorded state. A scenario reports them as it began and as it failed, and a restart session reports them as the previous session left them, so an edit the adapter never heard is told apart from a move the host did not act on. The webpack and Next sessions also log each pass of each compiler with the records as it saw them, and the host's own verdict on every cached module it rebuilt. Every failure of a Turbopack session that reports the host's output, a scenario's or a restart's, lists the pool's shared compile store, since any of them can make the pool compile more than it should: each publication with the state it was compiled for and the scratch directory it was compiled in, and each lock with its holder, which tells two project states apart from one state compiled twice.

CI runs this installed-host rehearsal once on Linux inside the batched `e2e.yml` job. Installation and minimal CLI execution have the sole six-target OS matrix in `setup.yml`. Host workers share the install and immutable Go build cache; their mutable projects and process lifetimes remain isolated.

The installed package's export map must match this executable host inventory. Adding an adapter without a direct contract fails the rehearsal. Core graph/proof scenarios remain in `tests/test-unplugin`; its Bun and Vite boundary cases join the same Linux integration batch. Long-lived Next development CLIs run in owned process trees and are stopped after their HTTP assertions.

Rollup's initial-error check uses its one-shot API before reusing the plugin in a watcher. Its watch API emits the first error before its filesystem subscriptions are ready and can miss an immediate repair even with a plain native plugin. Later error/recovery transitions run through the live watcher. Farm's initial compilation failure requires a replacement compiler through its public API; incremental failures recover in the same compiler.
