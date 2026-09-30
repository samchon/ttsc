import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";

import { MYTYPE_V2 } from "../../internal/adapter-webpack/MYTYPE_V2";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies a running webpack watcher re-runs the consumer's loader when a
 * type-only graph input changes.
 *
 * Watch mode learns what to watch from the dependencies the loader registered,
 * not from a cache. A type file reachable only through a type-only edge must
 * therefore be registered, or editing it would never trigger a rebuild. Polling
 * watch keeps the scenario deterministic across platforms.
 *
 * 1. Start a polling webpack watcher over the type-edge project with a graph
 *    producer.
 * 2. After the first build, rewrite the type file with a new interface.
 * 3. Assert a rebuild embeds the new interface within the timeout.
 *
 * @evidence contracts/testing.md#behavioral-verification Real polling watch first embeds ID: STRING then rebuild eventually embeds AGE: NUMBER after type edit, with persistent cache disabled.
 * @evidence contracts/testing.md#independent-expectations Authored declaration literals fix old/new output; timeout rejects missing observable watch rebuild.
 * @evidence contracts/testing.md#distinguishing-cases Type-only edge edit while running watcher; persistent-cache twin tests a separate channel.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_webpack_watch_rebuilds_through_a_type_only_edge is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual webpack watch registration, loader redelivery and native transform must connect across erased type import.
 * @evidence contracts/e2e.md#shared-execution One real compiler/watch session serves initial and later compilations; native artifacts can be shared while timestamp/content transitions remain local.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Watcher closes via finish and compiler closes in finally. Persistent cache is disabled so it cannot bypass loader redelivery. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real polling watch first embeds ID: STRING then rebuild eventually embeds AGE: NUMBER after type edit, with persistent cache disabled. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_webpack_watch_rebuilds_through_a_type_only_edge(): Promise<void> {
  const root = createTypeEdgeProject(true);
  const config = await createWebpackConfig(root);
  // Watch invalidation is the channel under test here; disable the
  // persistent cache so it cannot mask a missing watch registration.
  delete config.cache;
  const bundle = () =>
    fs.readFileSync(path.join(root, "out", "bundle.js"), "utf8");

  const compiler = webpack(config);
  try {
    await new Promise<void>((resolve, reject) => {
      let edited = false;
      let watching: ReturnType<typeof compiler.watch> | undefined;
      const timeout = setTimeout(() => {
        reject(
          new Error(
            "webpack watch did not rebuild through the type-only edge within 120s",
          ),
        );
      }, 120_000);
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
      watching = compiler.watch(
        { aggregateTimeout: 100, poll: 100 },
        (error, stats) => {
          try {
            if (error) {
              throw error;
            }
            assert.ok(stats);
            assert.equal(
              stats.hasErrors(),
              false,
              stats.toString({ errors: true }),
            );
            if (!edited) {
              assert.match(bundle(), /ID: STRING/);
              edited = true;
              fs.writeFileSync(
                path.join(root, "src", "mytype.ts"),
                MYTYPE_V2,
                "utf8",
              );
              return;
            }
            if (!/AGE: NUMBER/.test(bundle())) {
              // An intermediate rebuild that has not picked the edit up yet;
              // keep waiting for the next compilation.
              return;
            }
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
