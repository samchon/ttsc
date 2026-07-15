import fs from "node:fs/promises";
import type { UnpluginContextMeta } from "unplugin";

import { unplugin } from "./api";
import { sourceFilePattern } from "./core/index";
import type { TtscUnpluginOptions } from "./core/options";

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
 * Transform context handed to the raw unplugin transform under Bun.
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
const bunTransformContext = {
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
 * Only the `onLoad` hook is used; other hooks are not needed for a
 * source-to-source transform.
 */
export interface BunLikeBuild {
  /**
   * Register a loader callback for files matching `filter`.
   *
   * The callback receives the absolute file path and must return the
   * transformed file contents plus the `loader` Bun should apply next. The
   * `loader` matters most for the runtime path (`Bun.plugin`), where Bun must
   * be told the returned contents are still TypeScript so it keeps transpiling
   * them before execution.
   */
  onLoad(
    options: { filter: RegExp },
    loader: (args: {
      path: string;
    }) => Promise<{ contents: string; loader: BunLoader }>,
  ): void;
}

/**
 * Create a ttsc plugin for Bun's bundler AND runtime.
 *
 * Bun does not implement the unplugin protocol, so this adapter instantiates
 * the raw unplugin transform and wires it to Bun's `onLoad` hook manually. The
 * adapter reads each matching file from disk and forwards the content to the
 * ttsc transform; if the transform returns no changes the original source is
 * passed through unchanged.
 *
 * The same object works for `Bun.build({ plugins: [ttsc()] })` (bundler) and
 * for `Bun.plugin(ttsc())` / a `bunfig.toml` preload (runtime) — see
 * `bun-register`. Every result carries an explicit `loader` so Bun keeps
 * transpiling the emitted TypeScript at runtime; `sourceFilePattern` only
 * matches TypeScript, so the loader is always `ts`/`tsx`.
 */
export default function bun(options?: TtscBunOptions): BunLikePlugin {
  return {
    name: "ttsc-unplugin",
    setup(build) {
      // Build the raw transform lazily on first load rather than in `setup`.
      // Bun runs `setup` synchronously when the plugin is registered, so a
      // runtime registration (bun-register) that resolves its effective options
      // through a provider must defer that resolution until after any explicit
      // `register(options)` call in the same tick. Deferring also keeps a single
      // transform (and its project cache) shared across every loaded module.
      let raw: ReturnType<typeof unplugin.raw> | undefined;
      build.onLoad({ filter: sourceFilePattern }, async (args) => {
        raw ??= unplugin.raw(
          resolveBunOptions(options),
          {} as UnpluginContextMeta,
        );
        const loader = bunLoaderFor(args.path);
        const source = await fs.readFile(args.path, "utf8");
        const result =
          typeof raw.transform === "function"
            ? await raw.transform.call(
                bunTransformContext as never,
                source,
                args.path,
              )
            : undefined;
        // Unpack both shorthand string and object result shapes.
        if (typeof result === "string") {
          return { contents: result, loader };
        }
        if (
          typeof result === "object" &&
          result !== null &&
          "code" in result &&
          typeof result.code === "string"
        ) {
          return { contents: result.code, loader };
        }
        return { contents: source, loader };
      });
    },
  };
}

/**
 * Pick the Bun loader for a matched file. `sourceFilePattern` is
 * `/\.[cm]?tsx?$/`, so a trailing `x` (`.tsx`/`.ctsx`/`.mtsx`) is JSX-flavored
 * TypeScript and everything else (`.ts`/`.cts`/`.mts`) is plain TypeScript.
 */
function bunLoaderFor(filePath: string): BunLoader {
  return /x$/i.test(filePath) ? "tsx" : "ts";
}
