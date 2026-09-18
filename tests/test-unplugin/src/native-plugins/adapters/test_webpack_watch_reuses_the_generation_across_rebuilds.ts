import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";

import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies samchon/ttsc#1300 end to end, through a real webpack watch session.
 *
 * The core-level scenarios drive the pass boundary directly; this one proves
 * the wiring from a host's own rebuild signal to that boundary. unplugin maps
 * `buildStart` onto `compiler.hooks.make`, which fires once per compilation, so
 * a watch session opens a pass per rebuild — and the per-pass clear turned each
 * of those into a whole-project transform.
 *
 * The rebuild is triggered by rewriting `src/mytype.ts` with its own bytes.
 * That file reaches the entry only through a type-only import, so webpack knows
 * about it solely because the adapter registered it through `addWatchFile`; the
 * rewrite moves its timestamp without moving its content, which is exactly the
 * shape a rebuild must cost nothing. Timestamp snapshots are pinned explicitly
 * so the scenario does not rest on webpack's default snapshot strategy, and the
 * run log lives outside the project so the transform's own input walk never
 * sees the counter.
 *
 * The compile count alone would not prove anything: a compilation that did not
 * rebuild the entry runs no delivery, and so costs no compile under the old
 * code either. The scenario therefore waits for a compilation that actually
 * re-ran the loader before it reads the count.
 */
export async function test_webpack_watch_reuses_the_generation_across_rebuilds(): Promise<void> {
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-webpack-watch-log-"),
    "compiles.bin",
  );
  const root = createTypeEdgeProject(true, false, runLog);
  const entry = TestUnpluginProject.mainFile(root);
  const typeOnly = path.join(root, "src", "mytype.ts");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const config = await createWebpackConfig(root);
  // Watch invalidation is the channel under test, so the persistent cache must
  // not stand in for it, and the snapshot strategy has to be timestamps: a
  // hash-based snapshot would not see a rewrite that changed no bytes.
  delete config.cache;
  config.snapshot = {
    module: { hash: false, timestamp: true },
    resolve: { hash: false, timestamp: true },
  };

  const compiler = webpack(config);
  try {
    await new Promise<void>((resolve, reject) => {
      let builds = 0;
      let watching: ReturnType<typeof compiler.watch> | undefined;
      const finish = (failure?: unknown) => {
        clearTimeout(timeout);
        const settle = (closeError?: Error | null) => {
          const error = failure ?? closeError;
          if (error === undefined || error === null) {
            resolve();
            return;
          }
          reject(error instanceof Error ? error : new Error(String(error)));
        };
        if (watching === undefined) {
          settle();
          return;
        }
        watching.close(settle);
      };
      const timeout = setTimeout(() => {
        finish(
          new Error(
            "webpack watch did not rebuild after the type-only input was touched within 120s",
          ),
        );
      }, 120_000);
      watching = compiler.watch(
        { aggregateTimeout: 100, poll: 100 },
        (error, stats) => {
          try {
            if (error) throw error;
            assert.ok(stats);
            assert.equal(
              stats.hasErrors(),
              false,
              stats.toString({ errors: true }),
            );
            builds += 1;
            if (builds === 1) {
              assert.equal(
                compiles(),
                1,
                "the cold build compiles the project once",
              );
              // Same bytes, new timestamp: webpack's watcher sees a change, the
              // generation's recorded input does not.
              fs.writeFileSync(typeOnly, fs.readFileSync(typeOnly));
              return;
            }
            // A compilation that did not rebuild the entry proves nothing:
            // no delivery means no compile under the old code either. Keep
            // waiting for one that actually re-ran the loader.
            // `builtModules` is a WeakSet in webpack 5, so it is queried
            // rather than enumerated.
            const built = stats.compilation.builtModules;
            const rebuilt = [...stats.compilation.modules].some((module) => {
              const resource = (module as { resource?: unknown }).resource;
              return (
                typeof resource === "string" &&
                path.resolve(resource) === path.resolve(entry) &&
                built.has(module)
              );
            });
            if (!rebuilt) {
              return;
            }
            assert.equal(
              compiles(),
              1,
              "a rebuild that changed no compiler input must reuse the generation",
            );
            finish();
          } catch (failure) {
            finish(failure);
          }
        },
      );
    });
  } finally {
    await new Promise<void>((resolve) => {
      compiler.close(() => resolve());
    });
  }
}
