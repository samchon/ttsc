// Loading @ttsc/testing evaluates TestUnpluginProject, which seeds
// TTSC_TSGO_BINARY for in-process transformTtsc calls.
import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Options for the synthetic multi-file project used by the cache scenarios.
 *
 * `emitExternalKey` makes the fixture transform emit one output entry keyed
 * outside the project's directory walk (a `node_modules/**` path), reproducing
 * what the native host does for program dependencies (`node_modules`
 * declarations, sibling-package sources).
 */
interface ICacheProjectOptions {
  emitExternalKey?: boolean;
  fileCount?: number;
}

// Build the Go fixture once per process; transformTtsc shells out to it.
process.env.TTSC_CACHE_DIR ??= TestProject.tmpdir("ttsc-unplugin-cache-");

/**
 * Drive a real per-build transform over every module of a multi-file project
 * sharing one cache, then return how many whole-project transforms the fixture
 * plugin actually ran plus the per-module results.
 *
 * The fixture plugin appends one byte to a run-log file on every invocation, so
 * the caller can assert that the cache collapsed N modules into a single
 * compile.
 */
async function runProjectBuild(options: ICacheProjectOptions): Promise<{
  pluginRuns: number;
  outputs: string[];
}> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject(options);
  const cache = createTtscTransformCache();
  const outputs: string[] = [];
  for (const file of projectModules(project.root)) {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      resolveOptions(),
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
    outputs.push(result.code);
  }
  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  return { pluginRuns, outputs };
}

/**
 * Asserts the per-build cache compiles a multi-file project once and serves
 * every other module from cache — the happy-path baseline.
 *
 * Every compiler output key sits inside the project walk, so this holds on both
 * the old and fixed code; the out-of-walk regression is pinned separately by
 * {@link assertCacheHitsDespiteOutOfWalkOutputKey}. A single `transformTtsc`
 * over N modules sharing one cache must spawn the native transform once; the
 * remaining modules read their output from the cached whole-project result.
 */
async function assertCacheTransformsMultiFileProjectOnce(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({ fileCount: 6 });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}

/**
 * Asserts samchon/ttsc#252: the cache still hits when the transform output
 * includes an entry keyed outside the project's directory walk.
 *
 * The stored hash snapshot and the per-module validation snapshot must draw
 * their keys from the same project walk. The regression overlaid the compiler's
 * output keys — which include `node_modules` declarations the validator never
 * re-hashes — on only the store side, so the snapshots never matched, the cache
 * missed on every module, and the whole project was re-transformed once per
 * file. Any real project importing a typed dependency triggers this.
 *
 * 1. Build a multi-file project whose fixture transform emits one
 *    `node_modules/**` output key.
 * 2. Run a per-build transform over every module sharing one cache.
 * 3. Assert the plugin ran exactly once (cache hit), not once per module.
 */
async function assertCacheHitsDespiteOutOfWalkOutputKey(): Promise<void> {
  const { pluginRuns, outputs } = await runProjectBuild({
    emitExternalKey: true,
    fileCount: 6,
  });
  assert.equal(pluginRuns, 1);
  assert.equal(outputs.length, 6);
  for (const code of outputs) {
    assert.match(code, /PROBED/);
  }
}

/**
 * Prime a shared cache with one real successful transform of the default
 * fixture and return the cache API, the single cache key, the resolved good
 * generation value, and the arguments needed to retry the same module.
 *
 * The eviction scenarios below reuse this to plant a failed generation under
 * the exact key `transformTtsc` computes, without depending on the private
 * cache-key encoding.
 */
async function primeSuccessfulTransform(): Promise<{
  api: {
    createTtscTransformCache: () => Map<string, Promise<unknown>>;
    resolveOptions: (raw?: unknown) => unknown;
    transformTtsc: (
      ...args: unknown[]
    ) => Promise<{ code: string } | undefined>;
  };
  cache: Map<string, Promise<unknown>>;
  key: string;
  good: unknown;
  file: string;
  source: string;
  options: unknown;
}> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject();
  const cache = api.createTtscTransformCache();
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  const options = api.resolveOptions();
  const first = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(first, "expected the primed transform to produce output");
  TestUnpluginProject.assertTransformedToPlugin(first.code);
  assert.equal(cache.size, 1);
  const key = [...cache.keys()][0]!;
  const good = await cache.get(key);
  return { api, cache, key, good, file, source, options };
}

/**
 * Asserts a rejected in-flight transform generation is surfaced to the caller
 * and evicted, so a corrected environment recovers.
 *
 * The cache stores the transform Promise before it settles so concurrent
 * callers share one compile. If a rejected generation stayed cached, a
 * transient toolchain/host failure would become permanent for a long-lived
 * Metro or Turbopack worker: every later request for the unchanged module would
 * replay the old rejection instead of retrying. Replacing the primed success
 * with a rejected Promise reproduces the `await transformed` branch exactly.
 */
async function assertRejectedTransformIsEvictedAndRecovers(): Promise<void> {
  const { api, cache, key, file, source, options } =
    await primeSuccessfulTransform();

  const rejected = Promise.reject(new Error("transient host failure"));
  rejected.catch(() => undefined); // suppress the unhandled-rejection warning
  cache.set(key, rejected);

  await assert.rejects(
    () => api.transformTtsc(file, source, options, undefined, cache),
    /transient host failure/,
  );
  assert.equal(cache.size, 0, "rejected generation must not stay cached");

  const recovered = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(recovered, "corrected retry must re-run the transform");
  TestUnpluginProject.assertTransformedToPlugin(recovered.code);
  assert.equal(cache.size, 1);
}

/**
 * Asserts a resolved host-`"exception"` envelope is surfaced and evicted.
 *
 * A generation can also fail by resolving to an `ITtscCompilerTransformation`
 * whose `type` is `"exception"`, which makes `selectTransformedSource` throw.
 * That is a failed generation too and must not be retained, or a long-lived
 * worker replays the exception forever. Reusing the primed generation's project
 * root and input hashes keeps `matchesCachedSource` passing so control reaches
 * the exception path.
 */
async function assertHostExceptionTransformIsEvictedAndRecovers(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  cache.set(
    key,
    Promise.resolve({
      ...(good as Record<string, unknown>),
      result: { type: "exception", error: new Error("host exploded") },
    }),
  );

  await assert.rejects(
    () => api.transformTtsc(file, source, options, undefined, cache),
    /host exploded/,
  );
  assert.equal(cache.size, 0, "resolved-exception generation must not persist");

  const recovered = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(recovered, "corrected retry must re-run the transform");
  TestUnpluginProject.assertTransformedToPlugin(recovered.code);
  assert.equal(cache.size, 1);
}

/**
 * Asserts a failed generation's cleanup cannot remove a newer generation
 * another caller installed under the same key.
 *
 * Eviction is identity-guarded: it deletes the entry only when the cache still
 * holds the exact failed generation. This pins that guard by replacing the
 * failed generation with a fresh one after the failing call has begun awaiting
 * but before its rejection eviction runs; the newer generation must survive.
 */
async function assertStaleEvictionKeepsNewerGeneration(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  const stale = Promise.reject(new Error("stale generation"));
  stale.catch(() => undefined);
  cache.set(key, stale);
  const newer = Promise.resolve(good);

  // transformTtsc runs synchronously up to `await` on the stale generation, then
  // yields. Swap in the newer generation before the rejection eviction fires.
  const pending = api.transformTtsc(file, source, options, undefined, cache);
  cache.set(key, newer);

  await assert.rejects(() => pending, /stale generation/);
  assert.equal(
    cache.get(key),
    newer,
    "stale generation's eviction must not remove the newer entry",
  );
}

/**
 * Asserts concurrent transforms of one module still compile the project once.
 *
 * The eviction fix must not weaken the single-flight guarantee: two callers
 * racing for the same key share the one in-flight generation stored in the
 * cache. The run-log fixture counts whole-project compiles, so two concurrent
 * `transformTtsc` calls must produce exactly one.
 */
async function assertConcurrentTransformsCompileOnce(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 1 });
  const cache = createTtscTransformCache();
  const file = path.join(project.root, "src", "mod0.ts");
  const source = fs.readFileSync(file, "utf8");
  const options = resolveOptions();

  const [first, second] = await Promise.all([
    transformTtsc(file, source, options, undefined, cache),
    transformTtsc(file, source, options, undefined, cache),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.match(first.code, /PROBED/);
  assert.match(second.code, /PROBED/);

  const pluginRuns = fs.existsSync(project.runLog)
    ? fs.readFileSync(project.runLog, "utf8").length
    : 0;
  assert.equal(pluginRuns, 1, "concurrent callers must share one compile");
}

/**
 * Asserts the first delivery of each module does not re-read the entire
 * project.
 *
 * A project transform already returns output and an input snapshot for every
 * module. Re-hashing all P project files before selecting each of N outputs
 * makes the first build O(N x P), even though no generation has crossed a build
 * boundary. The cache can compare each supplied module source with its snapshot
 * entry and reserve complete validation for a repeated module request.
 */
async function assertFirstModuleDeliveriesDoNotRehashProject(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 24 });
  const modules = projectModules(project.root);
  const sources = new Map(
    modules.map((file) => [file, fs.readFileSync(file, "utf8")]),
  );
  const cache = createTtscTransformCache();
  const options = resolveOptions();

  const first = modules[0]!;
  assert.ok(
    await transformTtsc(first, sources.get(first)!, options, undefined, cache),
  );

  const originalReadFileSync = fs.readFileSync;
  let projectReads = 0;
  fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
    if (
      typeof file === "string" &&
      path.resolve(file).startsWith(`${path.resolve(project.root)}${path.sep}`)
    ) {
      ++projectReads;
    }
    return (originalReadFileSync as (...params: unknown[]) => unknown)(
      file,
      ...args,
    );
  }) as typeof fs.readFileSync;
  try {
    for (const file of modules.slice(1)) {
      assert.ok(
        await transformTtsc(
          file,
          sources.get(file)!,
          options,
          undefined,
          cache,
        ),
      );
    }
  } finally {
    fs.readFileSync = originalReadFileSync;
  }

  assert.equal(
    projectReads,
    0,
    "first module deliveries must not re-hash the project snapshot",
  );
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
}

/**
 * Asserts a stale input-mismatch cleanup neither deletes nor bypasses a newer
 * generation installed while the stale Promise was pending.
 */
async function assertStaleMismatchUsesNewerGeneration(): Promise<void> {
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();

  let resolveStale!: (value: unknown) => void;
  const stale = new Promise<unknown>((resolve) => {
    resolveStale = resolve;
  });
  cache.set(key, stale);
  const pending = api.transformTtsc(file, source, options, undefined, cache);

  const newer = Promise.resolve(good);
  cache.set(key, newer);
  resolveStale({
    ...(good as Record<string, unknown>),
    inputHashes: {},
  });

  const result = await pending;
  assert.ok(result);
  TestUnpluginProject.assertTransformedToPlugin(result.code);
  assert.equal(
    cache.get(key),
    newer,
    "a stale mismatch must retry the authoritative newer generation",
  );
}

/** Absolute, sorted list of the project's `src/*.ts` modules. */
function projectModules(root: string): string[] {
  const srcDir = path.join(root, "src");
  return fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => path.join(srcDir, name));
}

function createCacheProject(options: ICacheProjectOptions): {
  root: string;
  runLog: string;
} {
  const root = TestProject.tmpdir("ttsc-unplugin-cache-project-");
  const runLog = path.join(root, "plugin-runs.log");
  const fileCount = options.fileCount ?? 6;
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  for (let index = 0; index < fileCount; index += 1) {
    fs.writeFileSync(
      path.join(root, "src", `mod${index}.ts`),
      `export const value${index}: string = "PROBE";\n`,
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          // Options live at the plugin-entry top level: the protocol forwards
          // the whole entry as the plugin's config object.
          plugins: [
            {
              transform: "./plugin.cjs",
              name: "cache-probe",
              runLog,
              emitExternal: options.emitExternalKey === true,
            },
          ],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "plugin.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = (context) => ({",
      '  name: context.plugin.name ?? "cache-probe",',
      '  source: path.resolve(context.dirname, "go-plugin"),',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  if (options.emitExternalKey === true) {
    // The validator's directory walk skips node_modules; this file only has to
    // exist so the pre-fix store-side overlay could read and key it.
    const depDir = path.join(root, "node_modules", "dep");
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, "index.d.ts"), "export {};\n", "utf8");
  }
  writeGoPlugin(root);
  return { root, runLog };
}

/**
 * Write the multi-file counting transform sidecar.
 *
 * It echoes every `src/*.ts` file (rewriting the `PROBE` marker so output
 * differs from input), appends one byte to the configured `runLog` per
 * invocation so the test can count whole-project transforms, and optionally
 * emits one out-of-walk output key.
 */
function writeGoPlugin(root: string): void {
  const dir = path.join(root, "go-plugin");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "go.mod"),
    "module example.com/ttscunplugincacheprobe\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(dir, "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "strings"',
      ")",
      "",
      "type pluginDescriptor struct {",
      '  Config map[string]any `json:"config"`',
      "}",
      "",
      "type transformResult struct {",
      '  TypeScript map[string]string `json:"typescript"`',
      "}",
      "",
      "func main() { os.Exit(run(os.Args[1:])) }",
      "",
      "func run(args []string) int {",
      "  if len(args) == 0 { return 2 }",
      "  switch args[0] {",
      '  case "transform":',
      "    return transform(args[1:])",
      '  case "check", "version", "build":',
      "    return 0",
      "  default:",
      '    fmt.Fprintf(os.Stderr, "cache-probe: unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      "  fs.SetOutput(os.Stderr)",
      '  cwd := fs.String("cwd", "", "")',
      '  fs.String("tsconfig", "", "")',
      '  pluginsJSON := fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      "  cfg := firstConfig(*pluginsJSON)",
      "",
      '  if logPath := stringValue(cfg, "runLog"); logPath != "" {',
      "    if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {",
      '      f.WriteString("x")',
      "      f.Close()",
      "    }",
      "  }",
      "",
      "  ts := map[string]string{}",
      '  srcDir := filepath.Join(root, "src")',
      "  entries, err := os.ReadDir(srcDir)",
      "  if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      "  for _, e := range entries {",
      '    if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") { continue }',
      "    data, err := os.ReadFile(filepath.Join(srcDir, e.Name()))",
      "    if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '    ts["src/"+e.Name()] = strings.ReplaceAll(string(data), "PROBE", "PROBED")',
      "  }",
      '  if boolValue(cfg, "emitExternal") {',
      '    ts["node_modules/dep/index.d.ts"] = "export {};\\n"',
      "  }",
      "",
      "  data, _ := json.Marshal(transformResult{TypeScript: ts})",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
      "func firstConfig(input string) map[string]any {",
      '  if input == "" { return nil }',
      "  var plugins []pluginDescriptor",
      "  if err := json.Unmarshal([]byte(input), &plugins); err != nil { return nil }",
      "  if len(plugins) == 0 { return nil }",
      "  return plugins[0].Config",
      "}",
      "",
      "func stringValue(config map[string]any, key string) string {",
      "  value, _ := config[key].(string)",
      "  return value",
      "}",
      "",
      "func boolValue(config map[string]any, key string) bool {",
      "  value, _ := config[key].(bool)",
      "  return value",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

export {
  assertCacheHitsDespiteOutOfWalkOutputKey,
  assertCacheTransformsMultiFileProjectOnce,
  assertConcurrentTransformsCompileOnce,
  assertFirstModuleDeliveriesDoNotRehashProject,
  assertHostExceptionTransformIsEvictedAndRecovers,
  assertRejectedTransformIsEvictedAndRecovers,
  assertStaleEvictionKeepsNewerGeneration,
  assertStaleMismatchUsesNewerGeneration,
};
