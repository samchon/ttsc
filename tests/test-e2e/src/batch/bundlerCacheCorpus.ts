import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { type RollupCache, rollup } from "rollup";
import type { Compiler, Configuration, Stats, Watching } from "webpack";

import { BatchWorkspace } from "./BatchWorkspace";

// Webpack's filesystem cache reads its own CommonJS require.cache. Use the
// native CommonJS entry rather than Node 22.15's imported-CJS translator.
const webpack = createRequire(import.meta.url)(
  "webpack",
) as typeof import("webpack");

/**
 * Preserve real adapter cache frontiers with the original filesystem producer.
 *
 * A unique child of the selected runner trace root retains actual bridge rows
 * and at most 385 watch diagnostic rows. Without runner tracing, the same
 * observations belong to the fixture cache. Marker booleans and bounded error
 * text distinguish callbacks, delivery and closure without dumping output.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual webpack polling rebuild proves loader redelivery through builtModules while same bytes keep the observed TtscCompiler.transformAsync call count stable; content change publishes AGE:NUMBER. Fresh closed webpack compilers preserve filesystem cache across a changed compiler-only input, with a graph-free stale control. Rollup's retained cache skips unchanged transform and refreshes changed helper bytes.
 * @evidence contracts/testing.md#independent-expectations Authored interface bytes prescribe ID:STRING versus AGE:NUMBER. Actual webpack builtModules distinguishes no delivery from cached native work; existing private bridge-lookup receipts count observed API calls, never Programs or fixture-defined compile ticks. Rollup's real public transform hook counts adapter host delivery.
 * @evidence contracts/testing.md#distinguishing-cases Same-byte timestamp versus changed content, filesystem cache versus active watch, declared graph versus omitted graph, and Rollup unchanged versus changed retained cache remain distinct.
 * @evidence contracts/testing.md#execution-ownership The selected webpack batch calls one consolidated body. One watch compiler, four separately closed filesystem-cache compiler lifetimes and three closed Rollup builds share one upfront source island/available native fixture artifact. These are actual additional host/build costs, not zero executions or one Program.
 * @evidence contracts/e2e.md#necessary-boundary Real webpack loader/watch/filesystem-cache restoration and Rollup's cached module delivery must consult the actual adapter frontier. The native producer reads filesystem bytes and emits an envelope; its uppercase result does not prove native typechecker inference.
 * @evidence contracts/e2e.md#shared-execution One upfront project replaces separate watch/type/cache/control/Rollup fixtures. Ordered cases restore original type/config only after their actual host closes; cache-positive and negative controls use different owned cache namespaces without deleting caches.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Mutable source/config belongs only to this tools subtree. Actual watcher/compiler/bundle closes precede restoration or the next host; failed close retains the shared graph and blocks further mutations. A unique runner-owned trace child keeps observations outside compiler inputs; fixture-cache fallback retains standalone ownership. At most 384 bounded diagnostic rows plus one terminal row use synchronous append-close IO; sink failure is collected independently and cannot replace body or release failures. Trace/environment authority restores in finally.
 * @evidence contracts/e2e.md#preserved-coverage Restores original valid adapter invalidation/cache/loader-redelivery meanings. Fake compile/Program counts are not restored; private receipts observe real compiler API calls only. This does not certify development serve/HMR behavior.
 */
export async function bundlerCacheCorpus(
  workspace: BatchWorkspace.Workspace,
): Promise<void> {
  const root = path.join(workspace.root, "tools/bundler-cache");
  TestUnpluginProject.writePluginEntry(root);
  const mainFile = path.join(root, "src/main.ts");
  const originalMain = fs.readFileSync(mainFile);
  const typeFile = path.join(root, "src/mytype.ts");
  const configFile = path.join(root, "tsconfig.json");
  const originalType = fs.readFileSync(typeFile);
  const originalConfig = fs.readFileSync(configFile);
  const unpluginWebpack =
    await TestUnpluginRuntime.loadUnpluginAdapter("webpack");
  const replacement = "export interface MyType { id: string; age: number }\n";
  const previousTrace = process.env.TTSC_E2E_TRACE;
  const traceParent = previousTrace || workspace.cache;
  assert.ok(path.isAbsolute(traceParent));
  const traceRoot = fs.mkdtempSync(
    path.join(traceParent, "bundler-cache-observations-"),
  );
  process.env.TTSC_E2E_TRACE = traceRoot;
  const previousCache = process.env.TTSC_CACHE_DIR;
  process.env.TTSC_CACHE_DIR = workspace.cache;
  const failures: unknown[] = [];
  let releaseUnconfirmed = false;
  const diagnosticInstance = path.basename(traceRoot);
  const diagnosticFile = path.join(
    traceRoot,
    `${process.pid}-${diagnosticInstance}.jsonl`,
  );
  let diagnosticSequence = 0;
  let diagnosticFailed = false;
  let omittedDiagnosticRows = 0;
  // Callback volume is bounded separately; terminal observations remain eligible.
  // These rows observe the test's own host and never count as compiler calls.
  const observeWatch = (
    phase: string,
    data: Record<string, string | number | boolean | null> = {},
  ): void => {
    if (diagnosticFailed) return;
    if (diagnosticSequence >= 384 && phase !== "watch-settled") {
      omittedDiagnosticRows++;
      return;
    }
    try {
      fs.appendFileSync(
        diagnosticFile,
        JSON.stringify({
          schema: 1,
          event: "bundler-watch-phase",
          writerPid: process.pid,
          instance: diagnosticInstance,
          sequence: ++diagnosticSequence,
          invocation: diagnosticInstance + ":watch",
          at: new Date().toISOString(),
          data: {
            ...data,
            stage: phase,
            omittedDiagnosticRows,
            writerRuntime: process.version,
          },
        }) + "\n",
      );
    } catch (error) {
      diagnosticFailed = true;
      failures.push(
        new Error("webpack watch observation failed", { cause: error }),
      );
    }
  };
  const diagnosticError = (error: unknown): string =>
    (error instanceof Error
      ? error.name + ": " + error.message
      : String(error)
    ).slice(0, 1024);
  const observedCompilerCalls = (): number => {
    const events = fs
      .readdirSync(traceRoot)
      .filter((name) => name.endsWith(".jsonl"))
      .flatMap((name) =>
        fs
          .readFileSync(path.join(traceRoot, name), "utf8")
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
    assert.equal(
      events.some((event) => event.event === "integrity-failure"),
      false,
    );
    return events.filter(
      (event) =>
        event.event === "bridge-lookup" &&
        event.cwd === fs.realpathSync.native(root) &&
        event.data?.operation === "TtscCompiler.transformAsync",
    ).length;
  };
  const config = (name: string): Configuration => ({
    context: root,
    mode: "development",
    devtool: false,
    entry: path.join(root, "src/main.ts"),
    output: { path: path.join(root, "out/" + name), filename: "bundle.js" },
    resolve: { extensions: [".ts", ".js"] },
    plugins: [unpluginWebpack()],
    cache: {
      type: "filesystem",
      cacheDirectory: path.join(root, ".cache/" + name),
    },
    snapshot: {
      module: { hash: true, timestamp: false },
      resolve: { hash: true, timestamp: false },
      resolveBuildDependencies: { hash: true, timestamp: false },
      buildDependencies: { hash: true, timestamp: false },
    },
  });
  const closeCompiler = async (compiler: Compiler): Promise<void> => {
    try {
      await new Promise<void>((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      );
    } catch (error) {
      releaseUnconfirmed = true;
      BatchWorkspace.retain(
        "bundler cache compiler closure remained unresolved",
      );
      throw error;
    }
  };
  const build = async (configuration: Configuration): Promise<string> => {
    const compiler = webpack(configuration);
    const errors: unknown[] = [];
    let text: string | undefined;
    try {
      const stats = await new Promise<Stats>((resolve, reject) =>
        compiler.run((error, value) =>
          error
            ? reject(error)
            : value
              ? resolve(value)
              : reject(new Error("no webpack stats")),
        ),
      );
      assert.equal(stats.hasErrors(), false, stats.toString({ errors: true }));
      text = fs.readFileSync(
        path.join(configuration.output!.path!, "bundle.js"),
        "utf8",
      );
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        await closeCompiler(compiler);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "webpack cache build/close failed");
    return text!;
  };
  const collect = async (
    name: string,
    operation: () => Promise<void>,
  ): Promise<void> => {
    if (releaseUnconfirmed) return;
    try {
      await operation();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    } finally {
      if (!releaseUnconfirmed) {
        fs.writeFileSync(typeFile, originalType);
        fs.writeFileSync(configFile, originalConfig);
      }
    }
  };
  try {
    await collect("webpack watch delivery and content frontier", async () => {
      const configuration = config("watch");
      configuration.cache = false;
      configuration.snapshot = {
        module: { hash: false, timestamp: true },
        resolve: { hash: false, timestamp: true },
      };
      const compiler = webpack(configuration);
      let watching: Watching | undefined;
      let phase = 0;
      let firstCalls = 0;
      let callbacks = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const errors: unknown[] = [];
      try {
        await new Promise<void>((resolve, reject) => {
          observeWatch("watch-start", { deadlineMs: 120_000 });
          timer = setTimeout(() => {
            observeWatch("deadline", { phase, callbacks });
            reject(
              new Error("webpack watch frontier did not settle within 120s"),
            );
          }, 120_000);
          watching = compiler.watch(
            { aggregateTimeout: 100, poll: 100 },
            (error, stats) => {
              callbacks++;
              if (callbacks <= 128)
                observeWatch("callback", {
                  phase,
                  callbacks,
                  error: error ? diagnosticError(error) : null,
                  hasStats: stats != null,
                });
              try {
                if (error) throw error;
                assert.ok(stats);
                assert.equal(
                  stats.hasErrors(),
                  false,
                  stats.toString({ errors: true }),
                );
                const code = fs.readFileSync(
                  path.join(configuration.output!.path!, "bundle.js"),
                  "utf8",
                );
                if (callbacks <= 128)
                  observeWatch("output", {
                    phase,
                    callbacks,
                    idMarker: /ID: STRING/.test(code),
                    ageMarker: /AGE: NUMBER/.test(code),
                  });
                if (phase === 0) {
                  assert.match(code, /ID: STRING/);
                  firstCalls = observedCompilerCalls();
                  assert.equal(
                    firstCalls,
                    1,
                    "one actual compiler API request owns the cold adapter delivery",
                  );
                  phase = 1;
                  observeWatch("same-byte-entry-write-start", {
                    phase,
                    compilerCalls: firstCalls,
                  });
                  // The host directly watches main. Unchanged compiler-only
                  // helper bytes do not move its project record or require
                  // loader delivery through an erased type-only import.
                  fs.writeFileSync(mainFile, originalMain);
                } else if (phase === 1) {
                  const rebuilt = [...stats.compilation.modules].some(
                    (module) => {
                      const resource = (module as { resource?: string })
                        .resource;
                      return (
                        resource !== undefined &&
                        fs.realpathSync.native(resource) ===
                          fs.realpathSync.native(mainFile) &&
                        stats.compilation.builtModules.has(module)
                      );
                    },
                  );
                  if (!rebuilt) return;
                  const compilerCalls = observedCompilerCalls();
                  observeWatch("entry-redelivered", {
                    phase,
                    compilerCalls,
                  });
                  assert.equal(
                    compilerCalls,
                    firstCalls,
                    "actual loader redelivery must not invoke the compiler for unchanged bytes",
                  );
                  phase = 2;
                  fs.writeFileSync(typeFile, replacement);
                  observeWatch("changed-helper-write", { phase });
                } else if (/AGE: NUMBER/.test(code)) {
                  phase = 3;
                  observeWatch("changed-helper-published", { phase });
                  resolve();
                }
              } catch (failure) {
                observeWatch("callback-failed", {
                  phase,
                  error: diagnosticError(failure),
                });
                reject(failure);
              }
            },
          );
        });
      } catch (error) {
        observeWatch("watch-failed", { phase, error: diagnosticError(error) });
        errors.push(error);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (watching !== undefined) {
          try {
            observeWatch("watch-close-start", { phase });
            await new Promise<void>((resolve, reject) =>
              watching!.close((error) => (error ? reject(error) : resolve())),
            );
            observeWatch("watch-close-returned", { phase });
          } catch (error) {
            observeWatch("watch-close-failed", {
              phase,
              error: diagnosticError(error),
            });
            errors.push(error);
            releaseUnconfirmed = true;
            BatchWorkspace.retain("webpack watch closure remained unresolved");
          }
        }
        try {
          observeWatch("compiler-close-start", { phase });
          await closeCompiler(compiler);
          observeWatch("compiler-close-returned", { phase });
        } catch (error) {
          observeWatch("compiler-close-failed", {
            phase,
            error: diagnosticError(error),
          });
          errors.push(error);
        }
        observeWatch("watch-settled", {
          phase,
          callbacks,
          firstCompilerCalls: firstCalls,
          omittedCallbacks: Math.max(0, callbacks - 128),
          failures: errors.length,
        });
      }
      if (errors.length)
        throw new AggregateError(
          errors,
          "webpack watch frontier/closure failed",
        );
      assert.equal(phase, 3);
    });
    for (const withGraph of [true, false])
      await collect("webpack persisted cache " + withGraph, async () => {
        if (!withGraph) {
          const parsed = JSON.parse(originalConfig.toString("utf8"));
          parsed.compilerOptions.plugins =
            parsed.compilerOptions.plugins.filter(
              (plugin: { name: string }) => plugin.name !== "graph",
            );
          fs.writeFileSync(configFile, JSON.stringify(parsed));
        }
        const configuration = config(
          withGraph ? "persisted-positive" : "persisted-control",
        );
        const first = await build(configuration);
        assert.match(first, /ID: STRING/);
        assert.doesNotMatch(first, /AGE: NUMBER/);
        fs.writeFileSync(typeFile, replacement);
        const second = await build(configuration);
        if (withGraph) assert.match(second, /AGE: NUMBER/);
        else {
          assert.match(second, /ID: STRING/);
          assert.doesNotMatch(second, /AGE: NUMBER/);
        }
      });
    await collect("Rollup retained cache", async () => {
      const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
      let transforms = 0;
      const main = path.join(root, "src/main.ts");
      const buildRollup = async (cache?: RollupCache) => {
        const bundle = await rollup({
          cache,
          input: main,
          plugins: [
            adapter(),
            {
              name: "actual-delivery-counter",
              transform(_code, id) {
                if (path.resolve(id) === path.resolve(main)) transforms++;
                return null;
              },
            },
          ],
        });
        const errors: unknown[] = [];
        let result: { cache?: RollupCache; code: string } | undefined;
        try {
          const generated = await bundle.generate({ format: "esm" });
          result = {
            cache: bundle.cache,
            code: TestUnpluginProject.collectRollupOutputCode(generated.output),
          };
        } catch (error) {
          errors.push(error);
        } finally {
          try {
            await bundle.close();
          } catch (error) {
            releaseUnconfirmed = true;
            BatchWorkspace.retain(
              "Rollup retained-cache bundle closure remained unresolved",
            );
            errors.push(error);
          }
        }
        if (errors.length)
          throw new AggregateError(
            errors,
            "Rollup cached generation and close failed",
          );
        return result!;
      };
      const first = await buildRollup();
      assert.match(first.code, /ID: STRING/);
      assert.doesNotMatch(first.code, /AGE: NUMBER/);
      assert.ok(first.cache);
      const before = transforms;
      const second = await buildRollup(first.cache);
      assert.equal(second.code, first.code);
      assert.equal(transforms, before);
      fs.writeFileSync(typeFile, replacement);
      const third = await buildRollup(second.cache);
      assert.match(third.code, /AGE: NUMBER/);
    });
  } finally {
    if (previousTrace === undefined) delete process.env.TTSC_E2E_TRACE;
    else process.env.TTSC_E2E_TRACE = previousTrace;
    if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = previousCache;
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "actual bundler cache frontier failures",
    );
}
