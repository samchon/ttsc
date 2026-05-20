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
   * transformed file contents.
   */
  onLoad(
    options: { filter: RegExp },
    loader: (args: { path: string }) => Promise<{ contents: string }>,
  ): void;
}

/**
 * Create a ttsc plugin for Bun's bundler.
 *
 * Bun does not implement the unplugin protocol, so this adapter instantiates
 * the raw unplugin transform and wires it to Bun's `onLoad` hook manually. The
 * adapter reads each matching file from disk and forwards the content to the
 * ttsc transform; if the transform returns no changes the original source is
 * passed through unchanged.
 */
export default function bun(options?: TtscUnpluginOptions): BunLikePlugin {
  return {
    name: "ttsc-unplugin",
    setup(build) {
      const raw = unplugin.raw(options, {} as UnpluginContextMeta);
      build.onLoad({ filter: sourceFilePattern }, async (args) => {
        const source = await fs.readFile(args.path, "utf8");
        const result =
          typeof raw.transform === "function"
            ? await raw.transform.call({} as never, source, args.path)
            : undefined;
        // Unpack both shorthand string and object result shapes.
        if (typeof result === "string") {
          return { contents: result };
        }
        if (
          typeof result === "object" &&
          result !== null &&
          "code" in result &&
          typeof result.code === "string"
        ) {
          return { contents: result.code };
        }
        return { contents: source };
      });
    },
  };
}
