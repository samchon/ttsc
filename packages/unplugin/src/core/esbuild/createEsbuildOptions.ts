import fs from "node:fs";
import path from "node:path";
import type { UnpluginOptions } from "unplugin";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import { typescriptTransformSourcePattern } from "../source/typescriptTransformSourcePattern";
import { beginTtscTransformBuild } from "../transform/cache/beginTtscTransformBuild";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { inlineSourceMap } from "../transform/utils/inlineSourceMap";
import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import { classifyWatchInput } from "../transform/watch/classifyWatchInput";
import { missingWatchInputShape } from "../transform/watch/missingWatchInputShape";

/** Preserve esbuild's distinct file and directory dependency channels. */
export function createEsbuildOptions(
  options: ResolvedTtscUnpluginOptions,
  includes: (file: string) => boolean,
): UnpluginOptions {
  const cache = createTtscTransformCache();
  const owners = new WeakSet<object>();
  let lifecycles = 0;
  return {
    name: "ttsc-unplugin",
    esbuild: {
      setup(build) {
        // esbuild keeps one watch state per path for a whole build, and its
        // file read of an absent path overwrites whatever its directory read
        // recorded there (evanw/esbuild internal/fs/fs_real.go). A path handed
        // to both channels therefore loses its directory predicate whenever
        // another module's result lands after the directory read, so each
        // path is owned by one channel per build.
        const channels = new Map<string, "dirs" | "files">();
        // Setup can fail validation without receiving onDispose. Acquire only
        // at onStart, and retain a generation while another owner is active.
        build.onStart(() => {
          channels.clear();
          if (!owners.has(build)) {
            owners.add(build);
            lifecycles += 1;
          }
          beginTtscTransformBuild(cache);
        });
        build.onDispose(() => {
          if (!owners.delete(build)) return;
          lifecycles -= 1;
          if (lifecycles === 0) resetTtscTransformCache(cache);
        });
        const previous = new Map<
          string,
          { watchDirs: string[]; watchFiles: string[] }
        >();
        // There is no generic transform hook on this adapter. Its native
        // loader owns registration, independent of unplugin's hook order.
        build.onLoad(
          { filter: typescriptTransformSourcePattern, namespace: "file" },
          async ({ path: file }) => {
            if (!includes(file)) return;
            const watchFiles = new Set<string>();
            const watchDirs = new Set<string>();
            // A need the path's owner cannot serve is observed through the
            // nearest ancestor listing the directory channel may take, which
            // sees the path appear or vanish as either kind.
            const observe = (input: string, channel: "dirs" | "files") => {
              for (let target = input; ; ) {
                const owner = channels.get(target);
                if (owner === undefined || owner === channel) {
                  channels.set(target, channel);
                  (channel === "dirs" ? watchDirs : watchFiles).add(target);
                  return;
                }
                const parent = path.dirname(target);
                if (parent === target) return;
                target = parent;
                channel = "dirs";
              }
            };
            observe(file, "files");
            // Each input goes to the channel that observes its predicate
            // (samchon/ttsc#1388): `watchDirs` for a directory's entries or
            // its creation, and `watchFiles` for a file's content or creation.
            // An absent path either kind could replace is observed through
            // its parent's listing. A directory the compiler only checked
            // exists is not registered, so a tool writing a new entry below
            // `node_modules` no longer rebuilds; each descendant the compiler
            // probed is registered in its own right.
            const register = (inputs: readonly TtscWatchInput[]) => {
              for (const input of inputs) {
                const kind = classifyWatchInput(input);
                if (kind === "listing") observe(input.file, "dirs");
                else if (kind === "file") observe(input.file, "files");
                else if (kind === "missing") {
                  const shape = missingWatchInputShape(input);
                  if (shape === "directory") observe(input.file, "dirs");
                  else if (shape === "file") observe(input.file, "files");
                  else observe(path.dirname(input.file), "dirs");
                }
              }
            };
            let contents: string;
            let errors;
            try {
              const source = await fs.promises.readFile(file, "utf8");
              const result = await transformTtsc(
                file,
                source,
                options,
                undefined,
                cache,
                { addWatchFiles: register },
              );
              contents =
                result === undefined ? source : inlineSourceMap(result);
            } catch (error) {
              for (const input of previous.get(file)?.watchFiles ?? [])
                observe(input, "files");
              for (const input of previous.get(file)?.watchDirs ?? [])
                observe(input, "dirs");
              // Returning errors with dependencies lets an initially failing
              // build observe its repair; throwing discards those channels.
              errors = [
                {
                  text: error instanceof Error ? error.message : String(error),
                  detail: error,
                },
              ];
              contents = "";
            }
            const dependencies = {
              watchFiles: [...watchFiles],
              watchDirs: [...watchDirs],
            };
            previous.set(file, dependencies);
            return {
              contents,
              errors,
              loader: file.endsWith(".tsx") ? "tsx" : "ts",
              resolveDir: path.dirname(file),
              ...dependencies,
            };
          },
        );
      },
    },
  };
}
