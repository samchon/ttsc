import fs from "node:fs/promises";

import { isTransformTarget } from "../isTransformTarget";
import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";
import { resolveOptions } from "../options/resolveOptions";
import { bunTypeScriptTransformSourcePattern } from "../source/bunTypeScriptTransformSourcePattern";
import { typescriptTransformBunLoader } from "../source/typescriptTransformBunLoader";
import { beginTtscTransformBuild } from "../transform/cache/beginTtscTransformBuild";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { inlineSourceMap } from "../transform/utils/inlineSourceMap";
import type { BunLikeBuild } from "./BunLikeBuild";
import type { BunLikePlugin } from "./BunLikePlugin";
import type { BunLoader } from "./BunLoader";
import type { TtscBunOptions } from "./TtscBunOptions";

/** Resolve {@link TtscBunOptions} to a plain options object (or `undefined`). */
function resolveBunOptions(
  options?: TtscBunOptions,
): TtscUnpluginOptions | undefined {
  return typeof options === "function" ? options() : options;
}

/**
 * Create a ttsc plugin for Bun's bundler AND runtime.
 *
 * Bun does not implement the unplugin protocol, so this adapter wires the
 * shared ttsc transform core to Bun's `onLoad` hook directly. It reads each
 * included file from disk and forwards the content to the transform. Under
 * `Bun.build`, excluded files and no-op transforms return `undefined` so the
 * next loader retains ownership. Entries supplied through `BuildConfig.files`
 * also stay with Bun's in-memory loader: they are not filesystem project inputs
 * and reading the same path from disk would either fail or silently replace the
 * configured contents. The runtime `Bun.plugin()` API rejects an undefined
 * `onLoad` result, so that path explicitly returns the original source and
 * loader instead.
 *
 * The same object works for `Bun.build({ plugins: [ttsc()] })` (bundler) and
 * for `Bun.plugin(ttsc())` / a `bunfig.toml` preload (runtime) — see
 * `bun-register`. Every result carries an explicit `loader` so Bun keeps
 * transpiling the emitted TypeScript at runtime;
 * `bunTypeScriptTransformSourcePattern` only matches TypeScript, so the loader
 * is always `ts`/`tsx`. A runtime plugin instance is one immutable load
 * session, like Bun's own module cache; restart the process after changing
 * compiler inputs.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Host hook presence distinguishes a runtime session from bundler builds.
 *   Disk inputs enter the shared project transform; in-memory bundler entries
 *   remain Bun-owned, and runtime responses always retain the TypeScript parser.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Setup owns hooks and one cache; source inclusion, option normalization,
 *   compilation and source-map encoding remain delegated to their shared owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The runtime's original-source response implements Bun's required nonempty
 *   onLoad response. Hook absence and files ownership are real host differences,
 *   not overlapping-loader patches or special treatment of fixture paths.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain bundler/runtime responses, in-memory ownership,
 *   parser selection and process-session limits, following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node reads native delivered paths. Bun's in-memory key comparison separately
 *   models separator/drive-letter normalization on Windows while preserving
 *   component case and relative spelling rather than treating keys as disk paths.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A Set indexes F in-memory keys once at setup; a delivery performs a path-length
 *   lookup and reads S source bytes only for its disk input. First included
 *   loads also normalize the option overlay. Delegated transform work includes
 *   cache identity/validation, input/directory/byte proofs, misses' native compile
 *   and source-map encoding; source-file length alone does not bound it.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The first included transformable load resolves options once. One cache shares a validated
 *   project generation across deliveries; bundler start/end boundaries reset
 *   delivery proof, while a runtime retains its immutable module-load session.
 *   Coherent local output with unavailable observation shares first deliveries
 *   only inside this nonwatching pass through the common proof owner; no
 *   persistent host cache or shared publication can retain it.
 *   Setup snapshots the in-memory key population; changing host files/options
 *   is not authorized merely by an unchanged path or previously quiet callback.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Setup owns the F-key matcher, resolved options and project cache. Bundler
 *   end withdraws cached generations; it does not promise cancellation of an
 *   already running native compile, and the host still owns setup closures.
 *   Runtime retention is intended for the process session because this branch
 *   has no teardown hook. Key/option/project bytes have no fixed package-wide cap.
 */
export function bun(options?: TtscBunOptions): BunLikePlugin {
  return {
    name: "ttsc-unplugin",
    setup(build) {
      // Resolve options lazily on the first transformable TypeScript load.
      // Runtime registration may replace its pending configuration at any time
      // before then; the provider form must observe that last update without
      // installing a second shadowing loader.
      let resolved: ReturnType<typeof resolveOptions> | undefined;
      const getOptions = () =>
        (resolved ??= resolveOptions(resolveBunOptions(options)));
      const cache = createTtscTransformCache();
      const runtime = build.onStart === undefined;
      const ownsInMemoryFile = createBunInMemoryFileMatcher(build);
      // Bun.plugin() has no onStart callback, but one setup invocation belongs
      // to exactly one runtime process and module-loading session. Mark that
      // session up front so later first module deliveries can share a settled
      // generation proof, retaining source comparison rather than repeating
      // the complete snapshot validation. Bun.build()
      // immediately starts the same initial scope again through onStart and
      // repeats it for subsequent builds.
      beginTtscTransformBuild(cache);
      build.onStart?.(() => beginTtscTransformBuild(cache));
      if (!runtime) {
        build.onEnd?.(() => resetTtscTransformCache(cache));
      }
      build.onLoad(
        { filter: bunTypeScriptTransformSourcePattern },
        async (args) => {
          if (!runtime && ownsInMemoryFile(args.path)) {
            return undefined;
          }
          if (!isTransformTarget(args.path)) {
            if (!runtime) return undefined;
            return {
              contents: await fs.readFile(args.path, "utf8"),
              loader: bunLoaderFor(args.path),
            };
          }
          const loader = bunLoaderFor(args.path);
          const transformOptions = getOptions();
          const source = await fs.readFile(args.path, "utf8");
          // Bun has no dependency subscription API or reusable build result
          // cache. Builds are one-shot; runtime registration owns one immutable
          // module-load session. Withdraw our owned generation cache when a
          // fresh delivery cannot qualify reuse, without inventing watch inputs.
          const result = await transformTtsc(
            args.path,
            source,
            transformOptions,
            undefined,
            cache,
            {
              // The path this loader just read from disk is the file's own.
              exactPath: true,
              watching: false,
              // Bun has no reusable host module cache inside this immutable
              // build/runtime session. The common core owns generation eviction
              // and pass-only reuse; withdrawing it here recompiles every module
              // when Bun cannot supply synchronous observation (#1712, #1713).
              markVolatile: () => {},
            },
          );
          if (result !== undefined) {
            return { contents: inlineSourceMap(result), loader };
          }
          return runtime ? { contents: source, loader } : undefined;
        },
      );
    },
  };
}

/**
 * Pick the Bun loader recorded beside the matched extension in the shared
 * source table. Reaching this function without a table entry would mean Bun
 * invoked a callback whose registration filter did not match.
 */
function bunLoaderFor(filePath: string): BunLoader {
  const loader = typescriptTransformBunLoader(filePath);
  if (loader === undefined) {
    throw new Error(`Bun delivered an unsupported source path: ${filePath}`);
  }
  return loader;
}

/**
 * Create a stable ownership matcher for Bun's `BuildConfig.files` map.
 *
 * Bun preserves relative `files` keys in the corresponding `onLoad` path.
 * Preserve relative versus absolute spelling and dot segments exactly. Windows
 * normalizes separators and drive-letter case, but not component case. No path
 * is resolved against cwd, so `process.chdir()` cannot change ownership.
 */
function createBunInMemoryFileMatcher(
  build: BunLikeBuild,
): (file: string) => boolean {
  const files = build.config?.files;
  if (files === undefined) return () => false;
  const identities = new Set(Object.keys(files).map(bunPathIdentityKey));
  return (file) => identities.has(bunPathIdentityKey(file));
}

/**
 * Normalize the path forms Bun equates for its in-memory file map.
 *
 * Bun normalizes Windows separators and drive-letter case, but preserves path
 * component case, relative versus absolute spelling, and dot segments. A
 * filesystem identity key is broader and would suppress real disk transforms.
 */
function bunPathIdentityKey(file: string): string {
  if (process.platform !== "win32") return file;
  return file
    .replace(/\\/g, "/")
    .replace(
      /^([a-z]):/i,
      (_match, drive: string) => `${drive.toLowerCase()}:`,
    );
}
