import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import webpack from "webpack";

import { MYTYPE_V2 } from "../../../../internal/unplugin/internal/adapter-webpack/MYTYPE_V2";
import { createTypeEdgeProject } from "../../../../internal/unplugin/internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../../../internal/unplugin/internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies a real webpack watch session reuses the generation across rebuilds
 * (samchon/ttsc#1300).
 *
 * Unplugin maps `buildStart` onto `compiler.hooks.make`, which fires once per
 * compilation, so a watch session opens a pass per rebuild, and the per-pass
 * clear turned each of those into a whole-project transform. The rebuild is
 * triggered by rewriting the directly watched entry with its own bytes, which
 * moves its timestamp but not its content, exactly the shape a rebuild must
 * cost nothing. The compile count alone would prove nothing, because a
 * compilation that did not re-run the loader costs no compile either, so the
 * scenario waits for a compilation that actually re-ran it.
 *
 * 1. Start a webpack watcher with timestamp snapshots and a run log outside the
 *    project, and assert the cold build compiles once.
 * 2. Rewrite the directly watched entry with its own bytes.
 * 3. Wait for a rebuild that re-ran the loader and assert it compiled nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification Cold polling build compiles once; same-byte entry rewrite produces a compilation whose builtModules proves loader reran while compile count remains one. Unchanged compiler-only helper bytes do not require host redelivery through an erased import-type edge.
 * @evidence contracts/testing.md#independent-expectations Native byte counter plus independent webpack builtModules prevents a no-delivery false positive.
 * @evidence contracts/testing.md#distinguishing-cases Changed timestamp with unchanged bytes and actual entry rebuild; changed content has the separate watch test.
 * @evidence contracts/testing.md#execution-ownership This legacy native-plugin E2E donor is not selected by the current explicit batch runner. Its callable body retains the cases above; the selected bundlerCacheCorpus owns actual API-count and loader-delivery acceptance.
 * @evidence contracts/e2e.md#necessary-boundary Actual webpack timestamp watcher/make hook and native content proof distinguish host rebuild from native recompilation.
 * @evidence contracts/e2e.md#shared-execution One real compiler/watch session serves initial and later compilations. The shared experiment additionally performs the original type-only content edit after builtModules proves same-byte redelivery; its initial ID: STRING and later AGE: NUMBER oracle borrow the same graph/source project and native reader.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Watcher closes via finish and compiler closes in finally. Persistent cache is disabled so it cannot bypass loader redelivery. The optional shared continuation runs only after successful watcher and compiler close; original type bytes are supplied for exact restoration before sequential compiler reuse. Close errors now propagate and block that continuation. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Cold count1 and same-byte rewrite/builtModules/count1 remain. Optional shared continuation retains test_webpack_watch_rebuilds_through_a_type_only_edge initial ID: STRING, MYTYPE_V2 bytes, successful webpack stats and eventual AGE: NUMBER within 120s, with persistent cache disabled. Its polling host uses the timestamp strategy already required by the preceding same-byte contrast. Standalone defaults and both donors remain; actual selected survival is unverified.
 */
export async function test_webpack_watch_reuses_the_generation_across_rebuilds(
  includeTypeEdit = false,
  afterClose?: (prepared: {
    root: string;
    runLog: string;
    originalType: Buffer;
  }) => Promise<void>,
): Promise<void> {
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-webpack-watch-log-"),
    "compiles.bin",
  );
  const root = createTypeEdgeProject(true, false, runLog);
  // webpack's resolver spells a module physically, after every link, while the
  // project is named through its temporary directory, a link on macOS; the
  // rebuilt entry is therefore recognized by identity.
  const entry = fs.realpathSync.native(TestUnpluginProject.mainFile(root));
  const originalEntry = fs.readFileSync(entry);
  const typeOnly = path.join(root, "src", "mytype.ts");
  const originalType =
    afterClose === undefined ? undefined : fs.readFileSync(typeOnly);
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
      let contentEdited = false;
      let finished = false;
      let watching: ReturnType<typeof compiler.watch> | undefined;
      const finish = (failure?: unknown) => {
        if (finished) return;
        finished = true;
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
            contentEdited
              ? "webpack watch did not rebuild through the type-only edge within 120s"
              : "webpack watch did not rebuild after the entry was touched within 120s",
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
              if (includeTypeEdit)
                assert.match(
                  fs.readFileSync(path.join(root, "out", "bundle.js"), "utf8"),
                  /ID: STRING/,
                );
              assert.equal(
                compiles(),
                1,
                "the cold build compiles the project once",
              );
              // Same bytes, new timestamp on an actual host dependency. An
              // unchanged compiler-only helper need not redeliver this module.
              fs.writeFileSync(entry, originalEntry);
              return;
            }
            if (contentEdited) {
              if (
                !/AGE: NUMBER/.test(
                  fs.readFileSync(path.join(root, "out", "bundle.js"), "utf8"),
                )
              )
                return;
              finish();
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
                fs.realpathSync.native(resource) === entry &&
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
            if (includeTypeEdit) {
              contentEdited = true;
              fs.writeFileSync(typeOnly, MYTYPE_V2, "utf8");
              timeout.refresh();
            } else {
              finish();
            }
          } catch (failure) {
            finish(failure);
          }
        },
      );
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (afterClose !== undefined && originalType !== undefined)
    await afterClose({ root, runLog, originalType });
}
