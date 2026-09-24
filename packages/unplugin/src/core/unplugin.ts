import path from "node:path";
import {
  type NativeBuildContext,
  type UnpluginFactory,
  type UnpluginInstance,
  createUnplugin,
} from "unplugin";

import type { HostWatchBridge } from "./bridge/HostWatchBridge";
import { fallbackToolDirectory } from "./bridge/fallbackToolDirectory";
import { hostToolDirectory } from "./bridge/hostToolDirectory";
import { openHostWatchBridge } from "./bridge/openHostWatchBridge";
import { refreshProjectRecordFiles } from "./bridge/refreshProjectRecordFiles";
import { registerProjectRecord } from "./bridge/registerProjectRecord";
import { createEsbuildOptions } from "./esbuild/createEsbuildOptions";
import { farmPersistentCacheWithoutRecords } from "./farm/farmPersistentCacheWithoutRecords";
import { farmRecordFallback } from "./farm/farmRecordFallback";
import { isTransformTarget } from "./isTransformTarget";
import type { TtscUnpluginOptions } from "./options/TtscUnpluginOptions";
import { resolveOptions } from "./options/resolveOptions";
import type { TtscRollupDelivery } from "./rollup/TtscRollupDelivery";
import { createRollupCachedModuleProof } from "./rollup/createRollupCachedModuleProof";
import { rollupDeliveryOptions } from "./rollup/rollupDeliveryOptions";
import type { TtscTransformResult } from "./transform/TtscTransformResult";
import { createAliasPaths } from "./transform/alias/createAliasPaths";
import { beginTtscTransformBuild } from "./transform/cache/beginTtscTransformBuild";
import { createTransformCacheLease } from "./transform/cache/createTransformCacheLease";
import { createTtscTransformCache } from "./transform/cache/createTtscTransformCache";
import { declareTtscTransformPolling } from "./transform/cache/declareTtscTransformPolling";
import { resetTtscTransformCache } from "./transform/cache/resetTtscTransformCache";
import { sharedBuildTransformCache } from "./transform/cache/sharedBuildTransformCache";
import { hostDeclaresPolling } from "./transform/tracker/hostDeclaresPolling";
import { transformTtsc } from "./transform/transformTtsc";
import { isHostWrapperQuery } from "./transform/utils/isHostWrapperQuery";
import { stableStringify } from "./transform/utils/stableStringify";
import { stripQuery } from "./transform/utils/stripQuery";
import { createViteServeInputWatch } from "./vite/createViteServeInputWatch";
import { TTSC_SOURCE_MAP_STASH } from "./webpack/TTSC_SOURCE_MAP_STASH";
import { registerTtscSourceMapLoader } from "./webpack/registerTtscSourceMapLoader";
import { reportCompiledProjectRecords } from "./webpack/reportCompiledProjectRecords";

const name = "ttsc-unplugin";

/**
 * Unplugin factory that wires the ttsc transform pipeline into any supported
 * bundler (Vite, Rollup, Rolldown, webpack, Rspack, esbuild, Farm).
 *
 * The factory resolves raw options once, creates one transform cache for the
 * whole plugin instance (or, for webpack and Rspack, shares the one every
 * compiler with equal options uses), and captures Vite alias configuration via
 * the `vite.configResolved` hook so that path aliases are forwarded to the
 * generated tsconfig overlay. A host with a real `buildStart` opens a delivery
 * pass there and keeps its generation across passes; a watching Vite
 * development server keeps persistent validation instead, because its one
 * `buildStart` spans later HMR edits and so cannot mark a pass, while a dev
 * server configured without a watcher takes the pass lifecycle with them,
 * having declared it will observe no edit at all.
 */
const unpluginFactory: UnpluginFactory<
  TtscUnpluginOptions | undefined,
  false
> = (rawOptions = {}, meta) => {
  const options = resolveOptions(rawOptions);
  if (meta.framework === "esbuild") {
    return createEsbuildOptions(options, isTransformTarget);
  }
  // webpack and Rspack call this factory once per compiler, so the client,
  // server, and edge compilers of one Next build each compiled the same
  // program. Equal options share one process-wide cache, whose lease spans
  // all of their sessions (samchon/ttsc#1396).
  const shared =
    meta.framework === "webpack" || meta.framework === "rspack"
      ? sharedBuildTransformCache(stableStringify(options))
      : undefined;
  shared?.lease.acquire();
  const transformCache = shared?.cache ?? createTtscTransformCache();
  // A non-watching Vite build keeps its generation from one environment's
  // build to the next instead of compiling the program again for each.
  const viteBuildLease = createTransformCacheLease(transformCache);
  const serveInputs = createViteServeInputWatch();
  let aliases: unknown;
  let viteCommand: string | undefined;
  let viteWatching = true;
  // Whether a build-mode session is driven by Rollup's watcher. `build.watch`
  // is `null` for an ordinary build and an object under `--watch`, which is the
  // axis the disposal boundary actually turns on: only a watching build repeats
  // its build phase, and only a watching build ends at `closeWatcher`.
  let viteBuildWatching = false;
  // A restart can start the replacement plugin container before closing the
  // old one, and Vite calls buildEnd even for a container that never started.
  // Track the stable per-container PluginContext identity so that unstarted
  // old containers cannot dispose a replacement's freshly initialized cache.
  let viteBuildOwners = new WeakSet<object>();
  let viteBuildLifecycles = 0;
  // The observer a watching build gets for the compiler predicates its own
  // channel cannot observe, opened by the session's first watching delivery
  // and closed where the session ends (samchon/ttsc#1388).
  let bridge: HostWatchBridge | undefined;
  // The bridge's change sequence when the current pass opened. A pass proves
  // the generation once, at its first delivery, and serves every later module
  // of the pass from it, so a delivery may carry a state a change since the
  // pass opened has left, however late its own transform began. Registration
  // proves each input against changes since this token, not since the
  // transform, which would have answered the bridge's signal with the stale
  // delivery itself (samchon/ttsc#1460).
  let passStartedAt: number | undefined;
  // Farm reports no watch mode to a transform. Its development mode is the one
  // that watches: `farm start` and `farm watch` resolve it, `farm build` does
  // not.
  let farmWatching = false;
  // Farm's configured root, which Farm relates every watch file to and cannot
  // relate one on another Windows drive to, so its record lives below it, as
  // the Turbopack loader's lives below the root Turbopack resolved. Every other
  // host this factory serves takes any path, and its record lives below the
  // directory it runs in.
  let farmRoot: string | undefined;
  const hostRoot = (): string => farmRoot ?? process.cwd();
  // Where a host that cannot write below its root keeps its records
  // (samchon/ttsc#1480): below this user's temporary directory, which every
  // host this factory serves accepts but Farm on another drive.
  const recordFallback = (): { fallbackToolDirectory?: string } => {
    const fallback =
      farmRoot !== undefined
        ? farmRecordFallback(farmRoot)
        : fallbackToolDirectory(hostRoot());
    return fallback === undefined ? {} : { fallbackToolDirectory: fallback };
  };
  const recordDirectories = (): string[] => [
    hostToolDirectory(hostRoot()),
    ...Object.values(recordFallback()),
  ];
  const closeBridge = async (): Promise<void> => {
    const open = bridge;
    bridge = undefined;
    passStartedAt = undefined;
    await open?.close();
  };
  // Whether the host watches: it then observes the compiler's inputs through
  // the session's bridge, whose sequence token is taken before the compile,
  // as the dev server's is. Every other host is one-shot and proves the
  // record at its next start. Read from the context unplugin hands every hook,
  // `buildStart` and `transform` alike.
  const hostWatching = (context: {
    getNativeBuildContext?: () => NativeBuildContext | undefined;
    meta?: { watchMode?: boolean };
  }): boolean => {
    if (viteCommand === "serve") return false;
    const native = context.getNativeBuildContext?.();
    return native?.framework === "webpack" || native?.framework === "rspack"
      ? (native.compiler as { watchMode?: boolean }).watchMode === true
      : native?.framework === "farm"
        ? farmWatching
        : native === undefined && context.meta?.watchMode === true;
  };
  // Whether the adapter transforms a module id. A host-generated wrapper such
  // as `?raw` is not the file's program (samchon/ttsc#1394).
  const includes = (id: string): boolean =>
    isTransformTarget(stripQuery(id)) && !isHostWrapperQuery(id);
  // Whether the host restores modules from a cache of its own that the adapter
  // cannot answer module by module, so that a build start must prove every
  // record of the tool directory, and a watching session's bridge take each,
  // for the modules no delivery of this process produced (samchon/ttsc#1481).
  // webpack, Rspack, and Farm keep such caches, and none says which projects
  // it holds; webpack 5's and Rspack 2's key a module by neither the tsconfig
  // nor any option the adapter compiled it under, measured, so an instance's
  // own project is no bound either. Rollup, and a Vite build on Rollup, ask
  // before they serve each module from theirs, and the adapter proves the
  // record of the module then (`createRollupCachedModuleProof`); Rolldown and
  // a Vite build on it keep none, nor does a dev server across a restart. A
  // host this cannot tell apart proves every record.
  const restoresUnanswered = (context: {
    getNativeBuildContext?: () => NativeBuildContext | undefined;
    meta?: { rollupVersion?: string };
  }): boolean =>
    viteCommand !== "serve" &&
    (context.getNativeBuildContext?.() !== undefined ||
      context.meta?.rollupVersion === undefined);
  // The options a delivery to Rollup is compiled under, read again once the
  // aliases Vite resolves change.
  let deliveryOptions: { aliases: unknown; identity: string } | undefined;
  const currentDeliveryOptions = (): string => {
    if (deliveryOptions === undefined || deliveryOptions.aliases !== aliases)
      deliveryOptions = {
        aliases,
        identity: rollupDeliveryOptions(options, createAliasPaths(aliases)),
      };
    return deliveryOptions.identity;
  };
  // Rollup's cache, which Rollup, and a Vite build on Rollup, serve a module
  // from after asking `shouldTransformCachedModule`; Rolldown takes neither.
  // A build without a watching session's bridge proves the record of each
  // project whose module Rollup is about to restore.
  const cachedModules = createRollupCachedModuleProof(
    name,
    includes,
    currentDeliveryOptions,
    () => bridge === undefined,
  );
  const answersRollupCache = (context: {
    getNativeBuildContext?: () => NativeBuildContext | undefined;
    meta?: { rolldownVersion?: string; rollupVersion?: string };
  }): boolean =>
    viteCommand !== "serve" &&
    context.getNativeBuildContext?.() === undefined &&
    context.meta?.rollupVersion !== undefined &&
    context.meta.rolldownVersion === undefined;
  // A module Rollup would serve from its cache runs again while the bridge
  // owes the signal of a record it moved (samchon/ttsc#1460), and wherever its
  // delivery's record moved since (`createRollupCachedModuleProof`).
  const shouldTransformCachedModule = (module: {
    id: string;
    meta?: Record<string, unknown>;
  }): true | null =>
    bridge?.owes() === true || cachedModules.moved(module) ? true : null;

  return {
    name,
    enforce: "pre",

    vite: {
      configResolved(config) {
        // Vite resolves a root-relative replacement such as `"/src"` against
        // its root before the filesystem, so each alias carries the root it
        // belongs to (samchon/ttsc#1399).
        aliases = Array.isArray(config.resolve.alias)
          ? config.resolve.alias.map((alias) => ({
              ...alias,
              root: config.root,
            }))
          : config.resolve.alias;
        // Re-read per config resolution: a plugin instance reused across a
        // serve and a later build must stop routing missing inputs to the
        // serve-time poll, even though the closed server stays attached
        // (see the dispose note in vite/createViteServeInputWatch.ts).
        viteCommand = config.command;
        // `server.watch: null` disables Vite's watcher outright, which is how
        // a one-shot consumer (a `vitest --run` suite above all) configures the
        // dev server. Nothing can then deliver a change event, so every watch
        // registration is dead weight, and not cheap dead weight: Vite's
        // import analysis resolves each registered path like a real import of
        // the transformed module, once per module, which is the dominant cost
        // of a delivered module in a project with a real dependency graph
        // (samchon/ttsc#1246).
        viteWatching =
          (config as { server?: { watch?: unknown } }).server?.watch !== null;
        // Read on the same principle as the line above, from the half of the
        // config that governs a build rather than a server. The comparison is
        // loose where the server's is strict because the two defaults differ:
        // `server.watch` is an object unless explicitly `null`, while
        // `build.watch` is absent or `null` unless `--watch` supplies one.
        viteBuildWatching =
          (config as { build?: { watch?: unknown } }).build?.watch != null;
        // A server told to poll has said native notifications do not work on
        // its filesystem, so no generation may take a watcher's silence as
        // proof there (samchon/ttsc#1395). Vite's chokidar reads the same
        // environment override `hostDeclaresPolling` does.
        declareTtscTransformPolling(
          transformCache,
          hostDeclaresPolling(
            process.env,
            (
              config as {
                server?: { watch?: { usePolling?: boolean } | null };
              }
            ).server?.watch?.usePolling === true,
          ),
        );
      },
      // Compiler dependencies belong to the filesystem watch graph. Vite's
      // transform-context addWatchFile also inserts runtime imports, so none
      // of those dependencies may use that channel during serve (#1368).
      configureServer(server) {
        serveInputs.attach(server);
      },
      watchChange(id, change) {
        if (change.event === "delete") serveInputs.forget(stripQuery(id));
      },
      // Vite calls buildEnd when the dev server closes, and Rollup calls it at
      // the end of every build phase; drop every poller and, once the last
      // overlapping container has closed, every generation-owned filesystem
      // tracker as well.
      //
      // Disposing here is right wherever the end of a build phase is also the
      // end of the session: a dev server, and an ordinary one-shot build. It is
      // wrong for a watching build, whose watcher repeats build phases, so it
      // means "this pass ended" there — measured as
      // `buildStart -> buildEnd -> ... -> buildStart -> buildEnd` across
      // `vite build --watch` rebuilds. Disposing on that repeat discarded the
      // generation once per rebuild independently of the `buildStart` clear, so
      // fixing one of the two sites alone left this host recompiling the whole
      // project per edit (samchon/ttsc#1301). The watching build hands its
      // teardown to `closeWatcher` below instead.
      async buildEnd() {
        if (viteBuildOwners.delete(this)) {
          viteBuildLifecycles -= 1;
        }
        if (viteBuildLifecycles === 0) {
          if (viteCommand === "serve") {
            resetTtscTransformCache(transformCache);
          } else if (!viteBuildWatching) {
            // The next environment's build of the same app, if any, starts
            // within the lease's grace and proves the generation first.
            viteBuildLease.release();
          }
          await serveInputs.dispose();
        }
      },
      // The watching build's real teardown, and the only hook in a
      // `vite build --watch` trace that fires exactly once: buildEnd,
      // writeBundle and closeBundle all repeat per rebuild there. A generation
      // retained across passes owns directory watchers, so this is where they
      // are released. Vite's dev server drives no Rollup watcher and an
      // ordinary build closes its bundle instead, so neither reaches here;
      // a host that fired both would simply reset twice, which is idempotent.
      //
      // The container bookkeeping is cleared with the cache, and the owner set
      // is replaced rather than merely zeroed alongside it. A watcher closed
      // mid-rebuild leaves a container still registered, and its later
      // `buildEnd` would then decrement a counter that is already zero and
      // strand it below zero, after which the disposal above could never fire
      // again for this plugin instance.
      async closeWatcher() {
        viteBuildOwners = new WeakSet<object>();
        viteBuildLifecycles = 0;
        resetTtscTransformCache(transformCache);
        await serveInputs.dispose();
        await closeBridge();
      },
      // A `vite build` bundles through Rollup, whose cache the Rollup block
      // below answers; Rolldown, behind Vite 8, takes no such hook and ignores
      // it.
      shouldTransformCachedModule,
    },

    // Rollup and Rolldown carry none of the Vite block's hooks, so before this
    // they had no disposal site at all. They get both halves of the same
    // boundary: a watching session ends at `closeWatcher`, and a one-shot build
    // ends when its build phase does. `this.meta.watchMode` separates the two
    // there, the way `build.watch` does for Vite, so a one-shot build is not
    // left without a site the way `vite build` was (samchon/ttsc#1301).
    // unplugin merges each of these blocks only into its own adapter, so the
    // Vite adapter never receives them.
    //
    // A `buildEnd` at the top level instead of inside a block would be a
    // regression rather than a shorthand: unplugin forwards a top-level one to
    // esbuild's `onEnd` and to webpack's and Rspack's `hooks.emit`, each of
    // which repeats per rebuild, so those hosts would start discarding a valid
    // generation on every edit, which is samchon/ttsc#1300 again.
    rollup: {
      buildEnd(this: { meta?: { watchMode?: boolean } }) {
        if (this.meta?.watchMode !== true) {
          resetTtscTransformCache(transformCache);
        }
      },
      async closeWatcher() {
        resetTtscTransformCache(transformCache);
        await closeBridge();
      },
      // Rollup asks here before it serves a module from its cache. A record
      // moved while Rollup is building invalidates the cache that build
      // started from, and the build's own result then replaces it, so the
      // modules were served from the cache on the rerun and stayed on their
      // old output (samchon/ttsc#1460): while the bridge owes a signal every
      // module is transformed instead, which registers the record and answers
      // it. A build handed a cache has no watcher at all, and its modules run
      // again wherever their delivery's record moved since, which that build
      // proves first.
      shouldTransformCachedModule,
    },
    rolldown: {
      buildEnd(this: { meta?: { watchMode?: boolean } }) {
        if (this.meta?.watchMode !== true) {
          resetTtscTransformCache(transformCache);
        }
      },
      async closeWatcher() {
        resetTtscTransformCache(transformCache);
        await closeBridge();
      },
    },

    // These hosts map a top-level buildEnd to a per-compilation hook, so use
    // their true compiler or context teardown instead. The custom callbacks
    // are installed by unplugin alongside its ordinary transform wiring.
    webpack(compiler) {
      registerTtscSourceMapLoader(compiler);
      compiler.hooks.done.tap(name, (stats) => {
        reportCompiledProjectRecords(
          bridge,
          stats.compilation.fileDependencies,
        );
      });
      compiler.hooks.shutdown.tap(name, () => {
        // The shared generation outlives this compiler for the next one; the
        // lease resets it once no compiler has used it for its grace.
        if (shared === undefined) resetTtscTransformCache(transformCache);
        else shared.lease.release();
        closeBridge().catch(() => undefined);
      });
    },
    rspack(compiler) {
      registerTtscSourceMapLoader(compiler);
      compiler.hooks.done.tap(name, (stats) => {
        reportCompiledProjectRecords(
          bridge,
          stats.compilation.fileDependencies,
        );
      });
      compiler.hooks.shutdown.tap(name, () => {
        // The shared generation outlives this compiler for the next one; the
        // lease resets it once no compiler has used it for its grace.
        if (shared === undefined) resetTtscTransformCache(transformCache);
        else shared.lease.release();
        closeBridge().catch(() => undefined);
      });
    },
    farm: {
      // Farm offers no per-module opt-out of its persistent cache, so where
      // no record can be written its cache is turned off (samchon/ttsc#1480).
      config: (config: {
        compilation?: { persistentCache?: unknown };
        root?: string;
      }) => farmPersistentCacheWithoutRecords(config, process.cwd()),
      configResolved(config: {
        compilation?: { mode?: string; watch?: unknown };
        root?: string;
      }) {
        farmWatching =
          config.compilation?.mode === "development" ||
          (config.compilation?.watch ?? false) !== false;
        farmRoot =
          config.root === undefined ? undefined : path.resolve(config.root);
      },
      // Farm calls buildStart only for the initial compilation. Every update
      // opens a new pass so a failed verdict can recover, while an unchanged
      // successful generation remains reusable across its module deliveries.
      updateModules: {
        executor() {
          beginTtscTransformBuild(transformCache);
          passStartedAt = bridge?.begin();
        },
      },
    },
    buildStart() {
      cachedModules.begin();
      if (viteCommand !== undefined && !viteBuildOwners.has(this as object)) {
        viteBuildOwners.add(this as object);
        viteBuildLifecycles += 1;
        if (
          viteBuildLifecycles === 1 &&
          viteCommand === "build" &&
          !viteBuildWatching
        ) {
          viteBuildLease.acquire();
        }
      }
      // Persistent validation exists for a session that spans edits it can
      // observe, and a dev server told to open no watcher is not one:
      // `server.watch: null` leaves Vite with no change channel at all, so no
      // edit can reach the session, nothing invalidates what one touched, and
      // no client is hot-updated. Validating each delivery there does not buy
      // freshness, it buys incoherence — modules delivered before an edit and
      // after it would come from two different compilations of one program —
      // while costing a full derived-input proof per delivered module. The pass
      // lifecycle settles each module's first delivery against the generation
      // the session started from, exactly as a build does, and still
      // revalidates a module this session already delivered. A one-shot suite
      // configures precisely this server (`vitest --run` sets `server.watch =
      // null`) and is the workload behind samchon/ttsc#970
      // (samchon/ttsc#1260). The neighbouring watch-registration decision reads
      // the same two properties for the same reason.
      //
      // Opening a pass no longer discards the generation, so the `else` branch
      // is what every host with a repeating `buildStart` takes without paying a
      // whole-project transform per rebuild (samchon/ttsc#1300).
      if (viteCommand === "serve" && viteWatching) {
        resetTtscTransformCache(transformCache);
      } else {
        beginTtscTransformBuild(transformCache);
        // Before the host validates a module against its persistent cache:
        // a project whose state moved while nothing ran is heard through its
        // record, which only a proof here can move. A watching host's bridge
        // opens for its first pass and takes every record, so a project the
        // host restores whole from its cache, with no delivery in this
        // process, is observed from then on; a later pass of that session
        // has the bridge observing already, and a one-shot host proves the
        // records at each start. A host whose cache the adapter answers module
        // by module, or that keeps none, has nothing for either to cover.
        const opening = bridge === undefined;
        if (opening && hostWatching(this)) {
          bridge = openHostWatchBridge(hostRoot());
        }
        passStartedAt = bridge?.begin();
        if (opening && restoresUnanswered(this)) {
          // Below the root, and in the fallback a host that cannot write there
          // keeps its records in (samchon/ttsc#1480).
          for (const directory of recordDirectories()) {
            refreshProjectRecordFiles(directory, bridge);
          }
        }
      }
    },

    transformInclude: includes,

    async transform(source, id) {
      const file = stripQuery(id);
      if (!includes(id)) {
        return undefined;
      }
      // The project-root observer is already live when a Vite serve transform
      // begins. Its sequence token lets registration prove only inputs that
      // could have changed during compilation, instead of synchronously
      // re-reading every input in a large compiler graph.
      const serveStartedAt =
        viteCommand === "serve" && viteWatching
          ? serveInputs.begin()
          : undefined;
      const native = this.getNativeBuildContext?.();
      // The bridge opened with the first pass (`buildStart`); a host that
      // opened none before its first transform gets it here.
      const bridgeStartedAt = hostWatching(this)
        ? (passStartedAt ??= (bridge ??=
            openHostWatchBridge(hostRoot())).begin())
        : undefined;
      // A build host takes the project's record, and nothing else, through
      // the same channel that watches the module itself: Farm relates a watch
      // file to the module that named it, the webpack and Rspack loader
      // contexts hold the module-level channel (a compilation-level one
      // schedules a pass without invalidating the module), and every other
      // host has one `addWatchFile`.
      const loaderContext =
        native?.framework === "webpack" || native?.framework === "rspack"
          ? native.loaderContext
          : undefined;
      const addWatchFile: (input: string) => void =
        native?.framework === "farm"
          ? (input) => native.context.addWatchFile(file, input)
          : loaderContext !== undefined
            ? (input) => loaderContext.addDependency(input)
            : (input) => this.addWatchFile(input);
      // What the delivery was handed, for Rollup's cache to be answered by:
      // the record, or that no cache may serve the module.
      const handed: {
        record?: { digest: string; file: string };
        unprovable: boolean;
      } = { unprovable: false };
      const result = await transformTtsc(
        file,
        source,
        options,
        aliases,
        transformCache,
        {
          // A dev server keys each importer on its own inputs through its
          // module graph; a watcherless one has no invalidation channel and
          // needs no derivation.
          ...(viteCommand === "serve"
            ? viteWatching
              ? {
                  addWatchFiles: (inputs, failed) =>
                    serveInputs.replace(file, inputs, failed, serveStartedAt),
                  membership: true,
                }
              : {}
            : {
                project: {
                  register: (registration) => {
                    registerProjectRecord({
                      addWatchFile,
                      ...(bridge !== undefined && bridgeStartedAt !== undefined
                        ? {
                            bridge: {
                              instance: bridge,
                              startedAt: bridgeStartedAt,
                            },
                          }
                        : {}),
                      registration,
                    });
                    if (registration.digest === undefined)
                      handed.unprovable = true;
                    else
                      handed.record = {
                        digest: registration.digest,
                        file: registration.record,
                      };
                  },
                  toolDirectory: hostToolDirectory(hostRoot()),
                  ...recordFallback(),
                  watching: bridge !== undefined,
                },
              }),
          // A module the plugin declared volatile depends on non-file inputs,
          // which no file-dependency snapshot can represent; mark it
          // uncacheable where the bundler exposes that control.
          markVolatile: () => {
            handed.unprovable = true;
            const native = this.getNativeBuildContext?.();
            if (
              native?.framework === "webpack" ||
              native?.framework === "rspack"
            ) {
              native.loaderContext?.cacheable?.(false);
            }
          },
        },
      );
      // Unplugin's webpack and Rspack loaders drop the map of a module that
      // arrived without one, which the first loader's module always does, so
      // the loader after it hands the map on (samchon/ttsc#1392).
      if (
        result?.map !== undefined &&
        (native?.framework === "webpack" || native?.framework === "rspack") &&
        native.loaderContext !== undefined
      ) {
        TTSC_SOURCE_MAP_STASH.set(native.loaderContext, result);
      }
      if (!answersRollupCache(this)) return result;
      // The module carries its delivery into Rollup's cache, a module passed
      // through untransformed too: its project's record still decides whether
      // a later generation takes it in. Unchanged code with a `null` map is
      // how a Rollup plugin leaves a module's code and mappings as they are.
      const delivered: {
        code: string;
        map?: TtscTransformResult["map"] | null;
        meta: Record<string, TtscRollupDelivery>;
      } = {
        ...(result ?? { code: source, map: null }),
        meta: cachedModules.deliver(
          handed.unprovable
            ? null
            : {
                options: currentDeliveryOptions(),
                ...(handed.record === undefined
                  ? {}
                  : { record: handed.record }),
              },
        ),
      };
      return delivered;
    },
  };
};

/**
 * The unified `@ttsc/unplugin` instance, carrying one adapter per bundler.
 *
 * Built from one factory for Vite, Rollup, Rolldown, webpack, Rspack, esbuild,
 * and Farm, so every host runs the same transform core. Each host owns its own
 * lifecycle boundaries: when a delivery pass begins, when a generation is kept
 * across rebuilds, and when watchers are released. Compiler-only inputs reach
 * each host's watch channel without entering its runtime module graph.
 */
export const unplugin: UnpluginInstance<
  TtscUnpluginOptions | undefined,
  false
> = createUnplugin(unpluginFactory);
