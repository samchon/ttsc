import fs from "node:fs/promises";
import path from "node:path";

import {
  beginTtscTransformBuild,
  createTtscTransformCache,
  isTransformTarget,
  resolveOptions,
  transformTtsc,
} from "./core/index";
import type { TtscUnpluginOptions } from "./core/options";

/**
 * Bun normally reports filesystem source paths, while plugin-created virtual
 * ids may contain a NUL sentinel. A virtual id must stay with the plugin that
 * created it: claiming it here and trying to read it from disk prevents that
 * plugin's later loader from running.
 */
const bunSourceFilePattern = /^[^\x00]*\.[cm]?tsx?$/;

/**
 * Minimal subset of the Bun plugin API consumed by this adapter.
 *
 * Bun does not yet ship TypeScript types for its bundler plugin interface, so
 * we define the subset we need here. This keeps the adapter free of a Bun
 * runtime dependency while remaining type-safe.
 */
export interface BunLikePlugin {
  /** Plugin identifier shown in Bun bundler output. */
  name: string;
  /** Called by Bun when the plugin is registered. */
  setup(build: BunLikeBuild): void | Promise<void>;
}

/** Bun loader identifiers this adapter can emit (only TypeScript is matched). */
export type BunLoader = "ts" | "tsx";

/**
 * Options accepted by {@link bun}, either resolved eagerly or supplied through a
 * provider evaluated lazily on the first `onLoad` call.
 *
 * The provider form exists for the runtime registration path (`bun-register`),
 * where a single Bun plugin is registered on import but its effective options
 * may be overridden by an explicit `register(options)` call made in the same
 * synchronous tick. Resolving through the provider on first load, rather than
 * at registration, lets that later call win without Bun ever seeing a second
 * shadowing loader.
 */
export type TtscBunOptions =
  | TtscUnpluginOptions
  | (() => TtscUnpluginOptions | undefined);

/**
 * Transform hooks handed to the shared transform under Bun.
 *
 * The shared transform calls `addWatchFile` once per plugin-reported dependency
 * so type-only inputs can enter a bundler's watch graph. Bun's bundler and
 * runtime loaders expose no per-module dependency-registration channel, so the
 * hook is an explicit no-op here: reported dependencies cannot participate in
 * Bun invalidation, but a valid dependency list must never crash the loader by
 * reaching a missing context method. Passing an empty object made
 * `this.addWatchFile` `undefined`, so any plugin reporting dependencies threw
 * `TypeError: this.addWatchFile is not a function`.
 */
const bunTransformHooks = {
  addWatchFile(): void {},
};

/** Resolve {@link TtscBunOptions} to a plain options object (or `undefined`). */
function resolveBunOptions(
  options?: TtscBunOptions,
): TtscUnpluginOptions | undefined {
  return typeof options === "function" ? options() : options;
}

/**
 * Minimal subset of the Bun `BuildConfig` plugin build object.
 *
 * `onLoad` drives the source transform. Bun's bundler also exposes `onStart`,
 * which is used when available to forward the shared plugin's build lifecycle
 * and clear its per-build cache. The runtime plugin API omits that hook, so
 * plugin setup itself starts its one process-scoped module-loading session.
 */
export interface BunLikeBuild {
  /**
   * Build configuration exposed unchanged by Bun's bundler plugin builder.
   *
   * Runtime plugin builders do not supply `files`. Bun's bundler accepts an
   * in-memory file map whose values deliberately remain `unknown` here because
   * this adapter only needs to preserve ownership, not consume their contents.
   */
  config?: {
    files?: Readonly<Record<string, unknown>>;
  };
  /**
   * Register a callback for the start of a bundler build.
   *
   * Optional because `Bun.plugin()` runtime builders do not expose this hook.
   */
  onStart?(callback: () => void | Promise<void>): void;
  /**
   * Register a loader callback for files matching `filter`.
   *
   * The callback receives the file path and must return the transformed file
   * contents plus the `loader` Bun should apply next. Configured in-memory
   * files retain relative key spellings; ordinary disk files are normally
   * absolute. The `loader` matters most for the runtime path (`Bun.plugin`),
   * where Bun must be told the returned contents are still TypeScript so it
   * keeps transpiling them before execution.
   */
  onLoad(
    options: { filter: RegExp },
    loader: (args: {
      path: string;
    }) => Promise<{ contents: string; loader: BunLoader } | undefined>,
  ): void;
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
 * transpiling the emitted TypeScript at runtime; `bunSourceFilePattern` only
 * matches TypeScript, so the loader is always `ts`/`tsx`. A runtime plugin
 * instance is one immutable load session, like Bun's own module cache; restart
 * the process after changing compiler inputs.
 */
export default function bun(options?: TtscBunOptions): BunLikePlugin {
  return {
    name: "ttsc-unplugin",
    setup(build) {
      // Resolve options lazily on first load. Runtime registration may call
      // register(options) immediately after the import-time default
      // registration; the provider form must observe that last synchronous
      // update without installing a second shadowing loader.
      let resolved: ReturnType<typeof resolveOptions> | undefined;
      const getOptions = () =>
        (resolved ??= resolveOptions(resolveBunOptions(options)));
      const cache = createTtscTransformCache();
      const runtime = build.onStart === undefined;
      const ownsInMemoryFile = createBunInMemoryFileMatcher(build);
      // Bun.plugin() has no onStart callback, but one setup invocation belongs
      // to exactly one runtime process and module-loading session. Mark that
      // session up front so first delivery of every emitted project module is
      // constant-time instead of re-reading the whole project. Bun.build()
      // immediately starts the same initial scope again through onStart and
      // repeats it for subsequent builds.
      beginTtscTransformBuild(cache);
      build.onStart?.(() => beginTtscTransformBuild(cache));
      build.onLoad({ filter: bunSourceFilePattern }, async (args) => {
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
        const source = await fs.readFile(args.path, "utf8");
        const result = await transformTtsc(
          args.path,
          source,
          getOptions(),
          undefined,
          cache,
          bunTransformHooks,
        );
        if (result !== undefined) {
          return { contents: result.code, loader };
        }
        return runtime ? { contents: source, loader } : undefined;
      });
    },
  };
}

/**
 * Pick the Bun loader for a matched file. `bunSourceFilePattern` is
 * `/\.[cm]?tsx?$/`, so a trailing `x` (`.tsx`/`.ctsx`/`.mtsx`) is JSX-flavored
 * TypeScript and everything else (`.ts`/`.cts`/`.mts`) is plain TypeScript.
 */
function bunLoaderFor(filePath: string): BunLoader {
  return /x$/i.test(filePath) ? "tsx" : "ts";
}

/**
 * Create a stable ownership matcher for Bun's `BuildConfig.files` map.
 *
 * Bun preserves relative `files` keys in the corresponding `onLoad` path.
 * Preserve those spellings directly and resolve normalized variants against the
 * setup-time working directory. A later `process.chdir()` must not change which
 * paths this build configuration owns.
 */
function createBunInMemoryFileMatcher(
  build: BunLikeBuild,
): (file: string) => boolean {
  const files = build.config?.files;
  if (files === undefined) return () => false;
  const spellings = new Set(Object.keys(files));
  const setupDirectory = process.cwd();
  const identities = new Set(
    [...spellings].map((file) => bunPathIdentityKey(setupDirectory, file)),
  );
  return (file) =>
    spellings.has(file) ||
    identities.has(bunPathIdentityKey(setupDirectory, file));
}

/**
 * Normalize the path forms Bun equates for its in-memory file map.
 *
 * Bun normalizes Windows separators, drive-letter case, and dot segments but
 * preserves path-component case when matching `BuildConfig.files`. The normal
 * filesystem identity key is intentionally broader on Windows and would let a
 * differently cased virtual key suppress a real disk transform.
 */
function bunPathIdentityKey(directory: string, file: string): string {
  const absolute = path.resolve(directory, file);
  if (process.platform !== "win32") return absolute;
  return absolute
    .replace(/\\/g, "/")
    .replace(
      /^([a-z]):/i,
      (_match, drive: string) => `${drive.toLowerCase()}:`,
    );
}
