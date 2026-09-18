import fs from "node:fs";
import path from "node:path";
import type { UnpluginOptions } from "unplugin";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import { typescriptTransformSourcePattern } from "../source/typescriptTransformSourcePattern";
import { beginTtscTransformBuild } from "../transform/cache/beginTtscTransformBuild";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

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
        // Setup can fail validation without receiving onDispose. Acquire only
        // at onStart, and retain a generation while another owner is active.
        build.onStart(() => {
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
            const watchFiles = new Set<string>([file]);
            const watchDirs = new Set<string>();
            const register = (inputs: readonly TtscWatchInput[]) => {
              for (const input of inputs) {
                const observation =
                  input.evidence?.state?.codec === "predicates"
                    ? input.evidence.state.observation
                    : undefined;
                const directory =
                  observation?.directoryExists === true ||
                  observation?.stat === "directory" ||
                  observation?.accessibleEntries !== undefined;
                const missingDirectory =
                  observation?.directoryExists === false &&
                  observation.fileExists !== true &&
                  observation.stat !== "file";
                if (directory || missingDirectory) watchDirs.add(input.file);
                if (!directory || observation?.fileExists !== undefined)
                  watchFiles.add(input.file);
                // Failed envelopes carry no generation evidence. This rare
                // path must still classify existing recovery directories.
                if (input.evidence === undefined) {
                  try {
                    if (fs.statSync(input.file).isDirectory())
                      watchDirs.add(input.file);
                  } catch {
                    // Missing files are already tracked through watchFiles.
                  }
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
              contents = result?.code ?? source;
            } catch (error) {
              for (const input of previous.get(file)?.watchFiles ?? [])
                watchFiles.add(input);
              for (const input of previous.get(file)?.watchDirs ?? [])
                watchDirs.add(input);
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
