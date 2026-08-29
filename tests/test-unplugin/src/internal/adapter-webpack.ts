import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Configuration, Stats } from "webpack";
import webpack from "webpack";

/**
 * The interface `src/mytype.ts` starts with; the fixture plugin embeds the
 * uppercased file content into the transformed output, mirroring a type-driven
 * generator whose output depends on a consulted declaration.
 */
const MYTYPE_V1 = "export interface MyType { id: string }\n";

/** The edited interface; a sound cache must rebuild the consumer to see it. */
const MYTYPE_V2 = "export interface MyType { id: string; age: number }\n";

/**
 * Create the reproduction project from samchon/ttsc#716: `src/main.ts` reaches
 * `src/mytype.ts` only through a type-only import (webpack erases the edge from
 * its module graph), while the fixture plugin's output embeds the file's
 * content. `withGraph` toggles the producer emitting the reference graph edge —
 * the invalidation channel under test.
 *
 * `declareComplete` additionally declares `src/main.ts`'s dependency list
 * complete (samchon/ttsc#720) while the producer reports no dependencies at
 * all, which is the under-declaration defect: the plugin genuinely reads
 * `src/mytype.ts` but vouches for a list that omits it.
 */
function createTypeEdgeProject(
  withGraph: boolean,
  declareComplete = false,
  runLog?: string,
): string {
  const plugins: unknown[] = [
    {
      transform: "./plugin.cjs",
      name: "reader",
      operation: "read-configured-helper",
      path: "src/mytype.ts",
    },
  ];
  if (withGraph) {
    plugins.push({
      transform: "./plugin.cjs",
      name: "graph",
      operation: "emit-graph",
      edges: { "src/main.ts": ["src/mytype.ts"] },
    });
  }
  if (runLog !== undefined) {
    // Opt-in counter: the fixture plugin appends one byte per whole-project
    // transform, which is the only way to observe compiles from outside a
    // running bundler.
    plugins.push({
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    });
  }
  if (declareComplete) {
    plugins.push({
      transform: "./plugin.cjs",
      name: "completeness",
      operation: "declare-complete",
      complete: ["src/main.ts"],
    });
  }
  const root = TestUnpluginProject.createProject({
    plugins,
    source:
      'import type { MyType } from "./mytype";\n' +
      'export const value: string = goUpper("plugin");\n' +
      "console.log(value);\n",
  });
  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V1, "utf8");
  return root;
}

/**
 * Webpack configuration matching the field report: filesystem cache (what
 * Next.js persists under `.next/cache`) with hash-based snapshots so the
 * scenario does not depend on filesystem timestamp resolution. The cache
 * directory lives under `.cache/` so the transform's own project re-hash walk
 * ignores it, and output goes to `out/` for the same reason.
 */
async function createWebpackConfig(root: string): Promise<Configuration> {
  const unpluginWebpack =
    await TestUnpluginRuntime.loadUnpluginAdapter("webpack");
  return {
    context: root,
    mode: "development",
    devtool: false,
    entry: TestUnpluginProject.mainFile(root),
    output: {
      path: path.join(root, "out"),
      filename: "bundle.js",
    },
    resolve: { extensions: [".ts", ".js"] },
    plugins: [unpluginWebpack()],
    cache: {
      type: "filesystem",
      cacheDirectory: path.join(root, ".cache", "webpack"),
    },
    snapshot: {
      module: { hash: true, timestamp: false },
      resolve: { hash: true, timestamp: false },
      resolveBuildDependencies: { hash: true, timestamp: false },
      buildDependencies: { hash: true, timestamp: false },
    },
  };
}

/** Run one webpack build to completion, persisting the filesystem cache. */
async function buildOnce(config: Configuration): Promise<string> {
  const compiler = webpack(config);
  const stats = await new Promise<Stats | undefined>((resolve, reject) => {
    compiler.run((error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
  assert.ok(stats);
  assert.equal(stats.hasErrors(), false, stats.toString({ errors: true }));
  // Persistent cache entries are written on close; without it the second
  // build would not observe the first build's snapshots at all.
  await new Promise<void>((resolve, reject) => {
    compiler.close((error) => (error ? reject(error) : resolve()));
  });
  const output = config.output?.path;
  assert.ok(output);
  return fs.readFileSync(path.join(output, "bundle.js"), "utf8");
}

/**
 * Asserts the fixed behavior: with a producer emitting the reference graph,
 * editing the type file invalidates the consumer module in webpack's kept
 * filesystem cache, so the second build embeds the new interface without any
 * cache deletion.
 */
async function assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge(): Promise<void> {
  const root = createTypeEdgeProject(true);
  const config = await createWebpackConfig(root);

  const first = await buildOnce(config);
  assert.match(first, /ID: STRING/);
  assert.doesNotMatch(first, /AGE: NUMBER/);

  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const second = await buildOnce(config);
  assert.match(
    second,
    /AGE: NUMBER/,
    "the kept filesystem cache must rebuild the consumer through the type-only edge",
  );
}

/**
 * Asserts the reproduction baseline the graph exists to fix: without a graph
 * (and no plugin-reported dependencies), webpack's kept filesystem cache
 * restores the consumer module untouched after the type file changes, so the
 * second build still embeds the stale interface. If this control ever turns
 * fresh, the positive scenario above stops being evidence.
 */
async function assertWebpackFilesystemCacheServesStaleWithoutGraph(): Promise<void> {
  const root = createTypeEdgeProject(false);
  const config = await createWebpackConfig(root);

  const first = await buildOnce(config);
  assert.match(first, /ID: STRING/);

  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const second = await buildOnce(config);
  assert.doesNotMatch(
    second,
    /AGE: NUMBER/,
    "control scenario unexpectedly rebuilt: the positive test no longer proves the graph channel",
  );
}

/**
 * Asserts the defect surface of the completeness contract (samchon/ttsc#720):
 * an under-declared complete list makes webpack's kept filesystem cache serve
 * stale generated code, exactly as if no graph existed.
 *
 * The producer here emits the reference graph edge, so
 * {@link assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge} proves the
 * same project rebuilds soundly. The only difference is the declaration: the
 * plugin vouches that `src/main.ts`'s reported dependency list is complete
 * while reporting nothing, even though it reads `src/mytype.ts`. The host
 * honors the claim, drops the graph edge, and the loader never re-runs. This is
 * the responsibility transfer made observable: the platform behaves as
 * documented, and the stale output is the plugin's bug.
 */
async function assertWebpackFilesystemCacheServesStaleForUnderDeclaredComplete(): Promise<void> {
  const root = createTypeEdgeProject(true, true);
  const config = await createWebpackConfig(root);

  const first = await buildOnce(config);
  assert.match(first, /ID: STRING/);

  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const second = await buildOnce(config);
  assert.doesNotMatch(
    second,
    /AGE: NUMBER/,
    "an under-declared complete list must drop the graph edge: the host does not audit the declaration",
  );
}

/**
 * Asserts watch-mode invalidation: a running webpack watcher re-runs the
 * consumer's loader when a file reachable only through a type-only graph edge
 * changes. Polling watch keeps the scenario deterministic across platforms.
 */
async function assertWebpackWatchRebuildsThroughTypeOnlyEdge(): Promise<void> {
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

/**
 * Asserts samchon/ttsc#1300 end to end, through a real webpack watch session.
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
async function assertWebpackWatchReusesTheGenerationAcrossRebuilds(): Promise<void> {
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

export {
  assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge,
  assertWebpackFilesystemCacheServesStaleForUnderDeclaredComplete,
  assertWebpackFilesystemCacheServesStaleWithoutGraph,
  assertWebpackWatchRebuildsThroughTypeOnlyEdge,
  assertWebpackWatchReusesTheGenerationAcrossRebuilds,
};
