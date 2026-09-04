import fs from "node:fs";
import path from "node:path";
import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import { createUnplugin } from "unplugin";

import type { TtscUnpluginOptions } from "./options";
import { resolveOptions } from "./options";
import { typescriptTransformSourcePattern } from "./sourceExtensions";
import {
  beginTtscTransformBuild,
  captureWatchInputBaseline,
  captureWatchInputFileBaseline,
  collectExternalInputHashes,
  collectProjectInputHashSnapshot,
  collectProjectInputHashes,
  createTtscTransformCache,
  isDeclarationFile,
  isProjectWalkPath,
  isWatchInputKeyBaseline,
  resetTtscTransformCache,
  stripQuery,
  transformTtsc,
  watchInputEvidenceMatchesBaseline,
} from "./transform";
import { createViteServeMissingInputWatch } from "./viteServe";

const name = "ttsc-unplugin";
/**
 * Matches the exact TypeScript source extensions the ttsc transform handles:
 * `.ts`, `.tsx`, `.mts`, and `.cts`. JavaScript and invented extension forms
 * such as `.mtsx` are deliberately excluded.
 *
 * Shared with the Bun adapter (`bun.ts`) and the standalone Turbopack loader
 * (`turbopack.ts`) through {@link isTransformTarget}, so the filter is defined
 * once and every adapter answers the same way.
 */
export const sourceFilePattern = typescriptTransformSourcePattern;
/** Matches any path segment that is a `node_modules` directory (cross-platform). */
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;
/**
 * Matches virtual module ids: Rollup/Vite use a leading NUL byte (`\0`) as
 * convention.
 */
const virtualModulePattern = /\0/;

/**
 * Unplugin factory that wires the ttsc transform pipeline into any supported
 * bundler (Vite, Rollup, Rolldown, webpack, Rspack, esbuild, Farm).
 *
 * The factory resolves raw options once, creates one transform cache for the
 * whole plugin instance, and captures Vite alias configuration via the
 * `vite.configResolved` hook so that path aliases are forwarded to the
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
> = (rawOptions = {}) => {
  const options = resolveOptions(rawOptions);
  const transformCache = createTtscTransformCache();
  const missingInputs = createViteServeMissingInputWatch();
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
  // esbuild schedules one-shot onDispose callbacks after it settles the build
  // Promise. Acquire ownership only at onStart: plugin setup runs before build
  // option validation, and a validation failure has no onDispose callback with
  // which to release a setup-time owner. Once a build has actually started, the
  // count keeps an older delayed callback from disposing its active generation.
  const esbuildOwners = new WeakSet<object>();
  let esbuildLifecycles = 0;

  return {
    name,
    enforce: "pre",

    vite: {
      configResolved(config) {
        aliases = config.resolve.alias;
        // Re-read per config resolution: a plugin instance reused across a
        // serve and a later build must stop routing missing inputs to the
        // serve-time poll, even though the closed server stays attached
        // (see the dispose note in viteServe.ts).
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
      },
      // Vite serve funnels every transform-context `addWatchFile()` into the
      // module's added-import graph (`_addedImports`), which import-analysis
      // resolves like real imports. Capture the dev server so the transform
      // hook can route watch inputs that do not exist yet — superseding
      // resolution candidates above all — around that graph and still
      // invalidate their importers when the path is created.
      configureServer(server) {
        missingInputs.attach(server);
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
      buildEnd() {
        if (viteBuildOwners.delete(this)) {
          viteBuildLifecycles -= 1;
        }
        if (viteBuildLifecycles === 0) {
          missingInputs.dispose();
          if (viteCommand === "serve" || !viteBuildWatching) {
            resetTtscTransformCache(transformCache);
          }
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
      closeWatcher() {
        viteBuildOwners = new WeakSet<object>();
        viteBuildLifecycles = 0;
        missingInputs.dispose();
        resetTtscTransformCache(transformCache);
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
      closeWatcher() {
        resetTtscTransformCache(transformCache);
      },
    },
    rolldown: {
      buildEnd(this: { meta?: { watchMode?: boolean } }) {
        if (this.meta?.watchMode !== true) {
          resetTtscTransformCache(transformCache);
        }
      },
      closeWatcher() {
        resetTtscTransformCache(transformCache);
      },
    },

    // These hosts map a top-level buildEnd to a per-compilation hook, so use
    // their true compiler or context teardown instead. The custom callbacks
    // are installed by unplugin alongside its ordinary transform wiring.
    webpack(compiler) {
      compiler.hooks.shutdown.tap(name, () => {
        resetTtscTransformCache(transformCache);
      });
    },
    rspack(compiler) {
      compiler.hooks.shutdown.tap(name, () => {
        resetTtscTransformCache(transformCache);
      });
    },
    esbuild: {
      setup(build) {
        build.onStart(() => {
          if (!esbuildOwners.has(build)) {
            esbuildOwners.add(build);
            esbuildLifecycles += 1;
          }
        });
        build.onDispose(() => {
          if (!esbuildOwners.delete(build)) {
            return;
          }
          esbuildLifecycles -= 1;
          if (esbuildLifecycles === 0) {
            resetTtscTransformCache(transformCache);
          }
        });
      },
    },

    buildStart() {
      if (viteCommand !== undefined && !viteBuildOwners.has(this as object)) {
        viteBuildOwners.add(this as object);
        viteBuildLifecycles += 1;
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
      }
    },

    transformInclude(id) {
      const file = stripQuery(id);
      return isTransformTarget(file);
    },

    async transform(source, id) {
      const file = stripQuery(id);
      if (!isTransformTarget(file)) {
        return undefined;
      }
      return transformTtsc(file, source, options, aliases, transformCache, {
        // Register the derived watch inputs (plugin-reported `dependencies`
        // unioned with the host-owned reference graph) so type-only inputs
        // invalidate this module in watch mode and persistent caches;
        // bundlers erase type-only imports from their own module graph and
        // would otherwise serve stale generated code. Under Vite serve a
        // resolver input that is not proven to be a file must not enter
        // `addWatchFile`: import-analysis resolves added imports and 500s on
        // missing paths and directories, so those are watched against their
        // compiler predicates instead and invalidate this module when the
        // observation changes.
        addWatchFile: (watched, evidence) => {
          if (viteCommand === "serve" && missingInputs.serving()) {
            const observation =
              evidence?.state?.codec === "predicates"
                ? evidence.state.observation
                : undefined;
            const unsafePredicate =
              observation !== undefined &&
              observation.fileExists !== true &&
              observation.stat !== "file" &&
              observation.readFile?.ok !== true
                ? observation
                : undefined;
            if (unsafePredicate !== undefined) {
              missingInputs.watch(watched, path.resolve(file), unsafePredicate);
              return;
            }
            // Trust the generation's recorded existence when it supplied one:
            // every cache hit revalidates it, and probing each input again
            // costs one `existsSync` per input per delivered module.
            const unavailable =
              evidence?.unavailable ??
              (evidence === undefined
                ? !fs.existsSync(watched)
                  ? "missing"
                  : undefined
                : evidence.missing
                  ? "missing"
                  : undefined);
            if (unavailable !== undefined) {
              missingInputs.watch(
                watched,
                path.resolve(file),
                unavailable === "not-file" ? "file" : "exists",
              );
              return;
            }
          }
          // A dev server configured without a watcher can never deliver a
          // change event, so a registration here buys nothing, and it is not
          // free: Vite's import analysis resolves every registered path like a
          // real import of the transformed module, once per module. The
          // adapter's own missing-input poll above stays active either way,
          // because it never depended on Vite's watcher.
          if (viteCommand === "serve" && !viteWatching) {
            return;
          }
          this.addWatchFile(watched);
        },
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
      });
    },
  };
};

const unplugin: UnpluginInstance<TtscUnpluginOptions | undefined, false> =
  createUnplugin(unpluginFactory);

export type {
  TtscUnpluginCompilerOptionsJson,
  TtscUnpluginOptions,
} from "./options";
export type {
  TtscProjectDiscoveryFilesystem,
  TtscProjectTreeDiscoveryFilesystem,
  TtscProjectTsconfigCandidate,
  TtscProjectTsconfigDiscovery,
} from "./projectDiscovery";
export type {
  TtscProjectInputHashSnapshot,
  TtscTransformFilesystemOperations,
  TtscTransformHooks,
  TtscWatchInput,
  TtscWatchInputBaseline,
  TtscWatchInputEvidence,
  TtscWatchInputFileBaseline,
  TtscWatchInputKeyBaseline,
  TtscWatchInputState,
} from "./transform";
export type {
  ITsconfigSourceSnapshotEntry,
  ITtscProjectMembershipPolicy,
} from "./tsconfigPaths";
export {
  mergeMembershipPolicyOverlay,
  readProjectMembershipPolicy,
  readTsconfigSourceSnapshot,
} from "./tsconfigPaths";
export {
  beginTtscTransformBuild,
  captureWatchInputBaseline,
  captureWatchInputFileBaseline,
  collectExternalInputHashes,
  collectProjectInputHashSnapshot,
  collectProjectInputHashes,
  createTtscTransformCache,
  isProjectWalkPath,
  isWatchInputKeyBaseline,
  resetTtscTransformCache,
  resolveOptions,
  transformTtsc,
  unplugin,
  watchInputEvidenceMatchesBaseline,
};
export {
  discoverNearestProjectTsconfig,
  findNearestProjectTsconfig,
  findProjectTsconfigs,
} from "./projectDiscovery";

export default unplugin;

/**
 * Returns `true` when the module id refers to a real TypeScript source file
 * that should be processed by the ttsc transform.
 *
 * TypeScript only. {@link sourceFilePattern} deliberately excludes JavaScript,
 * so a `.js` module reaches no adapter's transform, and this docstring used to
 * say otherwise while the pattern it is built from said the truth
 * (samchon/ttsc#1309).
 *
 * Also excluded: virtual modules (NUL prefix), `.d.ts` declaration files, and
 * anything inside `node_modules`.
 */
export function isTransformTarget(id: string): boolean {
  return (
    sourceFilePattern.test(id) &&
    !virtualModulePattern.test(id) &&
    !isDeclarationFile(id) &&
    !nodeModulesPattern.test(id)
  );
}
