import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
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
 */
function createTypeEdgeProject(withGraph: boolean): string {
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

export {
  assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge,
  assertWebpackFilesystemCacheServesStaleWithoutGraph,
  assertWebpackWatchRebuildsThroughTypeOnlyEdge,
};
