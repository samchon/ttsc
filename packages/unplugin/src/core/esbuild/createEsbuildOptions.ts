import fs from "node:fs";
import path from "node:path";
import type { UnpluginOptions } from "unplugin";

import type { HostWatchBridge } from "../bridge/HostWatchBridge";
import { fallbackToolDirectory } from "../bridge/fallbackToolDirectory";
import { hostToolDirectory } from "../bridge/hostToolDirectory";
import { openHostWatchBridge } from "../bridge/openHostWatchBridge";
import { registerProjectRecord } from "../bridge/registerProjectRecord";
import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import { typescriptTransformSourcePattern } from "../source/typescriptTransformSourcePattern";
import { beginTtscTransformBuild } from "../transform/cache/beginTtscTransformBuild";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { inlineSourceMap } from "../transform/utils/inlineSourceMap";
import type { TtscProjectRegistration } from "../transform/watch/TtscProjectRegistration";

/**
 * The esbuild adapter: its native loader owns the transform and the
 * registration of the project's record, independent of unplugin's hook order.
 *
 * Esbuild watches each module and the project's record, which the bridge moves
 * when an input changes. Esbuild keeps one watch state per path for a whole
 * build, taken from the last loader result that named the path (evanw/esbuild
 * internal/fs), which is why the compiler's inputs themselves were never a
 * channel it could take: an edit landing after one module's loader returned and
 * before another's did was the second module's baseline, and the first module's
 * edit was masked, with no rebuild ever (samchon/ttsc#1463). The record is
 * named by every module's result with one content, the generation's state, so
 * no result masks another.
 *
 * Esbuild tells a plugin nothing about whether its context watches, so the
 * bridge opens for a one-shot `build()` as well, and closes when the last
 * context of this plugin is disposed, which `build()` reports at its end.
 */
export function createEsbuildOptions(
  options: ResolvedTtscUnpluginOptions,
  includes: (file: string) => boolean,
): UnpluginOptions {
  const cache = createTtscTransformCache();
  const owners = new WeakSet<object>();
  let lifecycles = 0;
  let bridge: HostWatchBridge | undefined;
  // The bridge's change sequence when the current pass opened, which every
  // delivery of the pass is registered against (samchon/ttsc#1460).
  let passStartedAt: number | undefined;
  return {
    name: "ttsc-unplugin",
    esbuild: {
      setup(build) {
        const root = path.resolve(
          build.initialOptions.absWorkingDir ?? process.cwd(),
        );
        // Setup can fail validation without receiving onDispose. Acquire only
        // at onStart, and retain a generation while another owner is active.
        build.onStart(() => {
          if (!owners.has(build)) {
            owners.add(build);
            lifecycles += 1;
          }
          beginTtscTransformBuild(cache);
          // No record is proven here: esbuild keeps no cache of a loader's
          // result, so every build runs every module through the loader,
          // and each delivery writes the record of the generation it read.
          passStartedAt = bridge?.begin();
        });
        build.onDispose(() => {
          if (!owners.delete(build)) return;
          lifecycles -= 1;
          if (lifecycles !== 0) return;
          resetTtscTransformCache(cache);
          const open = bridge;
          bridge = undefined;
          passStartedAt = undefined;
          open?.close().catch(() => undefined);
        });
        // The record each module's last result named, kept through a failed
        // load so the repair is observed by the same context.
        const previous = new Map<string, string[]>();
        build.onLoad(
          { filter: typescriptTransformSourcePattern, namespace: "file" },
          async ({ path: file }) => {
            if (!includes(file)) return;
            const watchFiles = new Set<string>([file]);
            const startedAt = (passStartedAt ??= (bridge ??=
              openHostWatchBridge(root)).begin());
            const register = (registration: TtscProjectRegistration) =>
              registerProjectRecord({
                addWatchFile: (input) => watchFiles.add(input),
                bridge: { instance: bridge!, startedAt },
                registration,
              });
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
                {
                  project: {
                    register,
                    toolDirectory: hostToolDirectory(root),
                    // esbuild takes a record anywhere, and cannot say whether
                    // it watches (samchon/ttsc#1480).
                    ...fallbackRecordDirectory(root),
                  },
                },
              );
              contents =
                result === undefined ? source : inlineSourceMap(result);
            } catch (error) {
              for (const input of previous.get(file) ?? [])
                watchFiles.add(input);
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
            const dependencies = [...watchFiles];
            previous.set(file, dependencies);
            return {
              contents,
              errors,
              loader: file.endsWith(".tsx") ? "tsx" : "ts",
              resolveDir: path.dirname(file),
              watchFiles: dependencies,
            };
          },
        );
      },
    },
  };
}

/** The fallback record directory of a root, spread into a project hook. */
function fallbackRecordDirectory(root: string): {
  fallbackToolDirectory?: string;
} {
  const fallback = fallbackToolDirectory(root);
  return fallback === undefined ? {} : { fallbackToolDirectory: fallback };
}
