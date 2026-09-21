import path from "node:path";
import {
  type UnpluginFactory,
  type UnpluginInstance,
  createUnplugin,
} from "unplugin";

import { BRIDGED_WATCH_INPUT_KINDS } from "./bridge/BRIDGED_WATCH_INPUT_KINDS";
import type { HostWatchBridge } from "./bridge/HostWatchBridge";
import { hostToolDirectory } from "./bridge/hostToolDirectory";
import { hostWatchIgnores } from "./bridge/hostWatchIgnores";
import { openHostWatchBridge } from "./bridge/openHostWatchBridge";
import { refreshMembershipDigestFiles } from "./bridge/refreshMembershipDigestFiles";
import { registerBuildWatchInputs } from "./bridge/registerBuildWatchInputs";
import { createEsbuildOptions } from "./esbuild/createEsbuildOptions";
import { isTransformTarget } from "./isTransformTarget";
import type { TtscUnpluginOptions } from "./options/TtscUnpluginOptions";
import { resolveOptions } from "./options/resolveOptions";
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
import type { TtscWatchInputKind } from "./transform/watch/TtscWatchInputKind";
import { createViteServeInputWatch } from "./vite/createViteServeInputWatch";
import { TTSC_SOURCE_MAP_STASH } from "./webpack/TTSC_SOURCE_MAP_STASH";
import { registerTtscSourceMapLoader } from "./webpack/registerTtscSourceMapLoader";

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
  // Farm relates every watch file to its configured root, so its inputs are
  // spelled under that root, whichever spelling its resolver delivered the
  // module under (samchon/ttsc#1462).
  let farmRoot: string | undefined;
  const closeBridge = async (): Promise<void> => {
    const open = bridge;
    bridge = undefined;
    passStartedAt = undefined;
    await open?.close();
  };

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
      // A watching `vite build` bundles through Rollup, which loses a sentinel
      // rewritten while it is building the way the Rollup block below
      // describes (samchon/ttsc#1460); Rolldown, behind Vite 8, takes no such
      // hook and ignores it.
      shouldTransformCachedModule({ id }: { id: string }) {
        return bridge?.owes(id) === true ? true : null;
      },
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
      // A sentinel rewritten while Rollup is building invalidates the cache
      // that build started from, and the build's own result then replaces it,
      // so the importer is served from the cache on the rerun and stays on its
      // old output (samchon/ttsc#1460). Rollup asks here before it serves a
      // module from its cache, and a module the bridge signalled since it last
      // registered is transformed instead, which registers it and answers the
      // signal.
      shouldTransformCachedModule({ id }: { id: string }) {
        return bridge?.owes(id) === true ? true : null;
      },
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
      compiler.hooks.shutdown.tap(name, () => {
        // The shared generation outlives this compiler for the next one; the
        // lease resets it once no compiler has used it for its grace.
        if (shared === undefined) resetTtscTransformCache(transformCache);
        else shared.lease.release();
        closeBridge().catch(() => undefined);
      });
    },
    farm: {
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
        passStartedAt = bridge?.begin();
        // Before the host validates a module against its persistent cache:
        // a root file that appeared while nothing ran is heard through the
        // project's membership record, which only a walk here can move.
        refreshMembershipDigestFiles(hostToolDirectory(process.cwd()));
      }
    },

    transformInclude(id) {
      // A host-generated wrapper such as `?raw` is not the file's program
      // (samchon/ttsc#1394).
      return isTransformTarget(stripQuery(id)) && !isHostWrapperQuery(id);
    },

    async transform(source, id) {
      const file = stripQuery(id);
      if (!isTransformTarget(file) || isHostWrapperQuery(id)) {
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
      const meta = (
        this as { meta?: { rolldownVersion?: string; watchMode?: boolean } }
      ).meta;
      // The compiler predicates a watching build's own channels observe
      // imprecisely or not at all, which go through the bridge instead. Its
      // sequence token is taken before the compile, as the dev server's is.
      const bridgedKinds: ReadonlySet<TtscWatchInputKind> | undefined =
        viteCommand === "serve"
          ? undefined
          : native?.framework === "webpack" || native?.framework === "rspack"
            ? (native.compiler as { watchMode?: boolean }).watchMode === true
              ? BRIDGED_WATCH_INPUT_KINDS.recursiveDirectoryChannel
              : undefined
            : native?.framework === "farm"
              ? farmWatching
                ? BRIDGED_WATCH_INPUT_KINDS.fileChannel
                : undefined
              : native === undefined && meta?.watchMode === true
                ? BRIDGED_WATCH_INPUT_KINDS.watcherPerPath
                : undefined;
      // Rolldown drops a change to a watched file that lands while it is
      // building, so an edit after ttsc returned a module never rebuilt it:
      // measured on the host matrix on every OS, intermittently
      // (samchon/ttsc#1465). Rspack drops a change that lands between the end
      // of a build and the moment its watcher records the file's modification
      // time as the baseline for the next: its watcher suppresses an event
      // whose file still carries the recorded time (`rspack_watcher`,
      // `Trigger::on_event` against `record_file_mtimes`), and its scan for
      // changes since the build's start covers only files the build newly
      // registered. Measured on the host matrix on macOS x64, where an input
      // repaired right after the failed build never rebuilt. Every input of
      // either host therefore goes to the bridge as well, and the bridge
      // repeats a signal until the module registers again, as it does for
      // Turbopack; a rewrite that lands during a build, or before Rspack's
      // baseline, is lost, and the next lands after it.
      const dropsLateChanges =
        meta?.rolldownVersion !== undefined || native?.framework === "rspack";
      const bridgeStartedAt =
        bridgedKinds === undefined
          ? undefined
          : (passStartedAt ??= (bridge ??= openHostWatchBridge(
              process.cwd(),
              {},
              undefined,
              dropsLateChanges,
            )).begin());
      const result = await transformTtsc(
        file,
        source,
        options,
        aliases,
        transformCache,
        {
          // A watcherless server has no invalidation channel and needs no
          // watch-input derivation. Every other host keeps its native contract.
          addWatchFiles:
            viteCommand === "serve" && !viteWatching
              ? undefined
              : (inputs, failed) => {
                  if (viteCommand === "serve") {
                    serveInputs.replace(file, inputs, failed, serveStartedAt);
                  } else {
                    registerBuildWatchInputs({
                      addWatchFile:
                        native?.framework === "farm"
                          ? (input) => native.context.addWatchFile(file, input)
                          : (input) => this.addWatchFile(input),
                      ...(bridge !== undefined &&
                      bridgedKinds !== undefined &&
                      bridgeStartedAt !== undefined
                        ? {
                            bridge: {
                              // The paths the watching compiler skips, Rspack's
                              // default `node_modules` among them, read where
                              // its `Watching` keeps them; under Rspack every
                              // input, since its own channel loses a change
                              // that lands before its baseline.
                              ...(native?.framework === "rspack"
                                ? { ignores: () => true }
                                : native?.framework === "webpack"
                                  ? {
                                      ignores: hostWatchIgnores(
                                        (
                                          native.compiler as {
                                            watching?: {
                                              watchOptions?: {
                                                ignored?: unknown;
                                              };
                                            };
                                          }
                                        ).watching?.watchOptions?.ignored,
                                      ),
                                    }
                                  : {}),
                              instance: bridge,
                              kinds: bridgedKinds,
                              startedAt: bridgeStartedAt,
                            },
                          }
                        : {}),
                      failed,
                      file,
                      inputs,
                      projectRoot: process.cwd(),
                      // Module-level channels, since compilation-level ones
                      // schedule a pass without invalidating the module.
                      ...((native?.framework === "webpack" ||
                        native?.framework === "rspack") &&
                      native.loaderContext !== undefined
                        ? { loader: native.loaderContext }
                        : {}),
                    });
                  }
                },
          // A watching session's bridge and the dev server's watcher observe
          // the project's root files as well; a one-shot build host skips
          // them (samchon/ttsc#1419), and hears them through the membership
          // record its persistent cache holds (samchon/ttsc#1468).
          membership: true,
          toolDirectory: hostToolDirectory(process.cwd()),
          ...(native?.framework === "farm" && farmRoot !== undefined
            ? { spelling: farmRoot }
            : {}),
          // A module the plugin declared volatile depends on non-file inputs,
          // which no file-dependency snapshot can represent; mark it
          // uncacheable where the bundler exposes that control.
          markVolatile: () => {
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
      return result;
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
