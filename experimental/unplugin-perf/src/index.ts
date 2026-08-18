/**
 * Reproduces the @ttsc/unplugin per-module cache cost on a synthetic project.
 *
 * The real transform core is driven over a generated `N`-file project with the
 * same cache lifecycle Rollup supplies. Cache-owned filesystem operations count
 * native plugin spawns, validation reads, metadata probes, and identity probes
 * without changing process-global `node:fs` behavior.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const experimentRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(experimentRoot, "../..");
const tmpRoot = path.join(experimentRoot, ".tmp");
const requireFromTtsc = createRequire(
  path.join(root, "packages", "ttsc", "package.json"),
);

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

async function main(): Promise<void> {
  fs.rmSync(tmpRoot, { force: true, recursive: true });
  fs.mkdirSync(tmpRoot, { recursive: true });

  // Native toolchain + shared plugin-build cache, mirroring the unit fixtures.
  process.env.TTSC_TSGO_BINARY ??= resolveTscBinary();
  process.env.TTSC_CACHE_DIR ??= path.join(tmpRoot, "cache");

  const adapter = await loadAdapter();
  const failures: string[] = [];

  console.log("Scenario A — output keys under project root (cache hits):");
  console.log("  invariant: plugin runs == 1 (one whole-project compile)\n");
  for (const count of [10, 25, 50, 100]) {
    recordFailure(
      failures,
      await measure(adapter, { count, emitExternalKey: false }),
    );
  }

  console.log(
    "\nScenario B — one output key outside the validator walk (node_modules):",
  );
  console.log(
    "  invariant: plugin runs == 1 (cache must hit despite the out-of-walk key)\n",
  );
  for (const count of [10, 25, 50]) {
    recordFailure(
      failures,
      await measure(adapter, { count, emitExternalKey: true }),
    );
  }

  console.log(
    "\nScenario C — graph-bearing envelope (typia >= 13.1.19 shape):",
  );
  console.log(
    "  invariant: plugin runs == 1 and macOS fs probes stay bounded per module;",
  );
  console.log(
    "  per-delivery watch-input derivation must not re-walk the whole graph\n",
  );
  for (const graphFanout of [25, 50, 100]) {
    recordFailure(
      failures,
      await measureGraphBuild(adapter, {
        count: 100,
        emitExternalKey: false,
        graphFanout,
      }),
    );
  }

  console.log(
    "\nScenario D — graph envelope without a build boundary (Vite serve):",
  );
  console.log(
    "  invariant: validation reads and synchronous stats stay bounded per module,",
  );
  console.log("  not the whole input union or project directory count\n");
  recordFailure(
    failures,
    await measureServeValidation(adapter, {
      count: 50,
      emitExternalKey: false,
      graphFanout: 50,
      partitionExternalInputs: true,
      unrelatedDirectoryCount: 100,
    }),
  );

  console.log(
    "\nScenario E — serve validation over a shared closure with globals:",
  );
  console.log(
    "  invariant: per-module reads stay bounded when every module reaches the",
  );
  console.log(
    "  same closure and the same global-scope declarations (the real shape)\n",
  );
  recordFailure(
    failures,
    await measureServeValidation(adapter, {
      count: 50,
      emitExternalKey: false,
      graphFanout: 50,
      graphGlobals: 50,
      partitionExternalInputs: false,
      // The chain graph makes ~N/2 missing candidates reachable per module on
      // average, one failed stat each, on top of the shared membership budget.
      statsBudget: 34,
      unrelatedDirectoryCount: 100,
    }),
  );

  if (failures.length !== 0) {
    console.error(
      `\nFAIL: a scenario violated its invariant:\n  ${failures.join("\n  ")}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    "\nOK: every build ran exactly one whole-project transform and watch-input" +
      " derivation stayed bounded per module.",
  );
}

function recordFailure(failures: string[], failure: string | undefined): void {
  if (failure !== undefined) {
    failures.push(failure);
  }
}

interface Adapter {
  beginTtscTransformBuild(cache: Map<string, Promise<unknown>>): void;
  createTtscTransformCache(
    operations?: Record<string, unknown>,
  ): Map<string, Promise<unknown>>;
  resolveOptions(options?: unknown): unknown;
  transformTtsc(
    id: string,
    source: string,
    options: unknown,
    aliases?: unknown,
    cache?: Map<string, Promise<unknown>>,
    hooks?: { addWatchFile?: (file: string) => void },
  ): Promise<unknown>;
}

/**
 * Bundle the real core source with esbuild (keeping `ttsc`/`unplugin` external)
 * so the production transform pipeline runs unmodified without a rebuilt lib.
 */
async function loadAdapter(): Promise<Adapter> {
  const esbuild = requireFromUnplugin("esbuild") as typeof import("esbuild");
  // Emit inside packages/unplugin so the external `ttsc`/`unplugin` imports
  // resolve through that package's node_modules (ttsc is a workspace symlink).
  const outfile = path.join(
    root,
    "packages",
    "unplugin",
    ".tmp-perf-adapter.mjs",
  );
  await esbuild.build({
    entryPoints: [
      path.join(root, "packages", "unplugin", "src", "core", "index.ts"),
    ],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    external: ["ttsc", "unplugin", "node:*"],
  });
  const mod = await import(pathToFileURL(outfile).href);
  fs.rmSync(outfile, { force: true });
  return mod as Adapter;
}

function requireFromUnplugin(specifier: string): unknown {
  return createRequire(path.join(root, "packages", "unplugin", "package.json"))(
    specifier,
  );
}

interface MeasureOptions {
  count: number;
  emitExternalKey: boolean;
  /**
   * Number of external `node_modules/dep{j}/index.d.ts` targets each module's
   * graph edges and consulted-dependency list carry. Zero keeps the envelope
   * graph-free (the typia 13.1.1 shape); a positive value stamps the
   * graph-bearing shape typia >= 13.1.19 produces.
   */
  graphFanout?: number;
  /**
   * Number of `node_modules/global{j}/index.d.ts` files stamped into the
   * envelope's `graph.globals`. Globals belong to every delivered module at
   * once, which is the shape a real `@types/*` package produces and the input
   * class a per-delivery revalidation multiplies by module count.
   */
  graphGlobals?: number;
  /** Give each module one disjoint external edge instead of the whole union. */
  partitionExternalInputs?: boolean;
  /**
   * Synchronous `stat` budget per delivered module, defaulting to the shared
   * membership budget of 8.
   *
   * A missing resolution candidate cannot be proven absent by metadata, so each
   * one reachable from the delivered file costs one failed `stat` per delivery.
   * That set is bounded by the file's reachable _source_ set, which a shared
   * closure makes large by construction, so a scenario that stamps a shared
   * closure states its own budget instead of hiding the cost under the
   * membership one.
   */
  statsBudget?: number;
  /** Unrelated nested project directories used to gate membership-stat cost. */
  unrelatedDirectoryCount?: number;
}

interface TransformHarness {
  adapter: Adapter;
  cache: Map<string, Promise<unknown>>;
  counters: {
    bytes: number;
    probes: number;
    reads: number;
    stats: number;
  };
  options: unknown;
}

function createTransformHarness(
  adapter: Adapter,
  project: string,
): TransformHarness {
  const counters = { bytes: 0, probes: 0, reads: 0, stats: 0 };
  const cache = adapter.createTtscTransformCache({
    readFile: (location: string) => {
      const contents = fs.readFileSync(location);
      counters.bytes += contents.length;
      counters.reads += 1;
      return contents;
    },
    realpath: (location: string) => {
      counters.probes += 1;
      return fs.realpathSync.native(location);
    },
    stat: (location: string) => {
      counters.stats += 1;
      return fs.statSync(location);
    },
    statBigInt: (location: string) => {
      counters.stats += 1;
      return fs.statSync(location, { bigint: true });
    },
  });
  return {
    adapter,
    cache,
    counters,
    options: adapter.resolveOptions({
      project: path.join(project, "tsconfig.json"),
    }),
  };
}

function resetCounters(harness: TransformHarness): void {
  harness.counters.bytes = 0;
  harness.counters.probes = 0;
  harness.counters.reads = 0;
  harness.counters.stats = 0;
}

async function measure(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const harness = createTransformHarness(adapter, project);
  const runLog = pluginRunLog(project);

  // Warm-up build: pays the one-time Go plugin compile + native program load so
  // the timed run reflects steady-state per-module cost, not toolchain startup.
  await runBuild(harness, project, runLog);

  resetCounters(harness);
  fs.writeFileSync(runLog, "");
  const started = process.hrtime.bigint();
  await runBuild(harness, project, runLog);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;
  const perFileReads = (harness.counters.reads / options.count).toFixed(1);
  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `reads=${String(harness.counters.reads).padStart(7)}  ` +
      `reads/file=${perFileReads.padStart(7)}  ` +
      `readMiB=${(harness.counters.bytes / 1048576).toFixed(1).padStart(6)}  ` +
      `${elapsedMs.toFixed(0).padStart(6)}ms`,
  );

  const scenario = options.emitExternalKey ? "B" : "A";
  return pluginRuns === 1
    ? undefined
    : `scenario ${scenario} N=${options.count}: pluginRuns=${pluginRuns} (expected 1)`;
}

/**
 * An fs probe pair (`existsSync` + `realpathSync.native`) is what one
 * `pathIdentityKey` call costs on macOS. A bounded watch-input derivation pays
 * that once per distinct graph path per generation, so the amortized budget
 * below is per module: well above the fixed point, far below the
 * O(edges)-per-delivery defect this scenario reproduces.
 */
const GRAPH_PROBES_PER_MODULE_BUDGET = 64;

/**
 * Drive a build-scoped run over a graph-bearing envelope and count the fs
 * probes a macOS host would pay for watch-input derivation. The first module
 * delivery compiles; the remaining deliveries are pure cache hits. The shared
 * path-identity resolver performs a physical-path probe on every supported
 * host, so the counter observes the real platform without mutating global
 * process identity after a Windows binary has already been selected.
 */
async function measureGraphBuild(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const harness = createTransformHarness(adapter, project);
  const runLog = pluginRunLog(project);

  await runBuild(harness, project, runLog);

  const modules = projectModules(project);
  const context = {
    addWatchFile: () => undefined,
    error: (message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message));
    },
  };
  fs.writeFileSync(runLog, "");
  process.env.PLUGIN_RUN_LOG = runLog;
  adapter.beginTtscTransformBuild(harness.cache);
  const [first, ...rest] = modules;
  await adapter.transformTtsc(
    first!,
    fs.readFileSync(first!, "utf8"),
    harness.options,
    undefined,
    harness.cache,
    context,
  );

  resetCounters(harness);
  const started = process.hrtime.bigint();
  for (const id of rest) {
    await adapter.transformTtsc(
      id,
      fs.readFileSync(id, "utf8"),
      harness.options,
      undefined,
      harness.cache,
      context,
    );
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;
  const edges = options.count * (options.graphFanout ?? 0) + options.count - 1;
  const probesPerModule = harness.counters.probes / rest.length;
  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `E=${String(edges).padStart(6)}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `probes=${String(harness.counters.probes).padStart(9)}  ` +
      `probes/file=${probesPerModule.toFixed(1).padStart(9)}  ` +
      `${elapsedMs.toFixed(0).padStart(7)}ms`,
  );

  if (pluginRuns !== 1) {
    return `scenario C N=${options.count} K=${options.graphFanout}: pluginRuns=${pluginRuns} (expected 1)`;
  }
  return probesPerModule <= GRAPH_PROBES_PER_MODULE_BUDGET
    ? undefined
    : `scenario C N=${options.count} K=${options.graphFanout}: probes/file=${probesPerModule.toFixed(1)} exceeds the bounded-derivation budget of ${GRAPH_PROBES_PER_MODULE_BUDGET} (per-delivery derivation re-walks the whole graph)`;
}

/**
 * Gate the serve-mode path: with no `buildStart` boundary the cache stays in
 * persistent-validation mode. Each module owns one disjoint external graph
 * input, so rereading the envelope union is visible as linear reads per module
 * while per-file validation stays under a fixed budget.
 */
async function measureServeValidation(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const harness = createTransformHarness(adapter, project);
  const runLog = pluginRunLog(project);
  const context = {
    addWatchFile: () => undefined,
    error: (message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message));
    },
  };

  // No buildStart anywhere: the cache never becomes build-scoped, which is
  // exactly the state Vite's development server leaves it in.
  process.env.PLUGIN_RUN_LOG = runLog;
  const modules = projectModules(project);
  for (const id of modules) {
    await adapter.transformTtsc(
      id,
      fs.readFileSync(id, "utf8"),
      harness.options,
      undefined,
      harness.cache,
      context,
    );
  }
  await new Promise<void>((resolve) => setImmediate(resolve));

  resetCounters(harness);
  const started = process.hrtime.bigint();
  for (const id of modules) {
    await adapter.transformTtsc(
      id,
      fs.readFileSync(id, "utf8"),
      harness.options,
      undefined,
      harness.cache,
      context,
    );
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;

  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `externals=${String(options.graphFanout ?? 0).padStart(4)}  ` +
      `globals=${String(options.graphGlobals ?? 0).padStart(4)}  ` +
      `shared=${options.partitionExternalInputs === true ? "no " : "yes"}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `reads=${String(harness.counters.reads).padStart(8)}  ` +
      `reads/file=${(harness.counters.reads / options.count).toFixed(1).padStart(8)}  ` +
      `stats/file=${(harness.counters.stats / options.count).toFixed(1).padStart(6)}  ` +
      `${elapsedMs.toFixed(0).padStart(7)}ms`,
  );
  const readsPerFile = harness.counters.reads / options.count;
  const statsPerFile = harness.counters.stats / options.count;
  if (pluginRuns !== 1) {
    return `serve validation N=${options.count} K=${options.graphFanout} G=${options.graphGlobals ?? 0}: pluginRuns=${pluginRuns} (expected 1)`;
  }
  if (readsPerFile > 16) {
    return `serve validation N=${options.count} K=${options.graphFanout} G=${options.graphGlobals ?? 0}: reads/file=${readsPerFile.toFixed(1)} exceeds the per-file validation budget of 16`;
  }
  const statsBudget = options.statsBudget ?? 8;
  return statsPerFile <= statsBudget
    ? undefined
    : `serve validation N=${options.count} dirs=${options.unrelatedDirectoryCount}: stats/file=${statsPerFile.toFixed(1)} exceeds the budget of ${statsBudget}`;
}

/**
 * Drive the transform core with Rollup's lifecycle: one build start, then one
 * transform for every project module in module order.
 */
async function runBuild(
  harness: TransformHarness,
  project: string,
  runLog: string,
): Promise<void> {
  const context = {
    addWatchFile: () => undefined,
    error: (message: unknown) => {
      throw message instanceof Error ? message : new Error(String(message));
    },
  };
  process.env.PLUGIN_RUN_LOG = runLog;
  harness.adapter.beginTtscTransformBuild(harness.cache);
  for (const id of projectModules(project)) {
    await harness.adapter.transformTtsc(
      id,
      fs.readFileSync(id, "utf8"),
      harness.options,
      undefined,
      harness.cache,
      context,
    );
  }
}

function projectModules(project: string): string[] {
  const srcDir = path.join(project, "src");
  return fs
    .readdirSync(srcDir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => path.join(srcDir, name));
}

/** Keep the observer outside the project snapshot it is measuring. */
function pluginRunLog(project: string): string {
  return path.join(tmpRoot, `${path.basename(project)}.plugin-runs`);
}

function createProject(options: MeasureOptions): string {
  const project = fs.mkdtempSync(path.join(tmpRoot, "project-"));
  const srcDir = path.join(project, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  for (let index = 0; index < options.count; index += 1) {
    fs.writeFileSync(
      path.join(srcDir, `mod${index}.ts`),
      `export const value${index}: string = "${index}";\n`,
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  for (
    let index = 0;
    index < (options.unrelatedDirectoryCount ?? 0);
    index += 1
  ) {
    const directory = path.join(
      project,
      "fixtures",
      `unused-${index}`,
      "nested",
    );
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "asset.txt"), "fixture\n", "utf8");
  }
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          plugins: [{ transform: "./plugin.cjs", name: "perf-fixture" }],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "plugin.cjs"),
    [
      'const path = require("node:path");',
      "",
      "module.exports = (context) => ({",
      '  name: "perf-fixture",',
      '  source: path.resolve(context.dirname, "go-plugin"),',
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  writeGoPlugin(project);
  if (options.emitExternalKey) {
    // The store-time hash overlay reads this file, so it must exist; the
    // validator's directory walk skips node_modules, which is the whole point.
    const depDir = path.join(project, "node_modules", "dep");
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(path.join(depDir, "index.d.ts"), "export {};\n", "utf8");
  }
  const graphFanout = options.graphFanout ?? 0;
  if (graphFanout > 0) {
    // The graph envelope's external targets must exist: the store-time
    // snapshot hashes every recorded external input.
    for (let index = 0; index < graphFanout; index += 1) {
      const depDir = path.join(project, "node_modules", `dep${index}`);
      fs.mkdirSync(depDir, { recursive: true });
      fs.writeFileSync(
        path.join(depDir, "index.d.ts"),
        `export declare const dep${index}: number;\n`,
        "utf8",
      );
    }
  }
  const graphGlobals = options.graphGlobals ?? 0;
  for (let index = 0; index < graphGlobals; index += 1) {
    const globalDir = path.join(project, "node_modules", `global${index}`);
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalDir, "index.d.ts"),
      `declare const ambient${index}: number;\n`,
      "utf8",
    );
  }
  // The Go sidecar keys its extra output entry only when asked.
  process.env.TTSC_PERF_EMIT_EXTERNAL = options.emitExternalKey ? "1" : "0";
  process.env.TTSC_PERF_GRAPH_FANOUT = String(graphFanout);
  process.env.TTSC_PERF_GRAPH_GLOBALS = String(graphGlobals);
  process.env.TTSC_PERF_PARTITION_EXTERNAL = options.partitionExternalInputs
    ? "1"
    : "0";
  return project;
}

/**
 * A minimal `package main` transform sidecar: it echoes every `src/*.ts` file
 * back as the transform output (identity), appends one byte to `PLUGIN_RUN_LOG`
 * per invocation so the harness can count whole-project re-transforms, and
 * optionally emits one out-of-walk output key to trigger the cache-miss bug.
 */
function writeGoPlugin(project: string): void {
  const dir = path.join(project, "go-plugin");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "go.mod"),
    "module example.com/ttscunpluginperf\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(dir, "main.go"),
    [
      "package main",
      "",
      "import (",
      '  "crypto/sha256"',
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "sort"',
      '  "strconv"',
      '  "strings"',
      ")",
      "",
      "type referenceGraph struct {",
      '  Edges      map[string][]string `json:"edges"`',
      '  Globals    []string            `json:"globals"`',
      '  Configs    []string            `json:"configs"`',
      '  Candidates map[string][]string `json:"candidates,omitempty"`',
      '  InputHashes map[string]*string `json:"inputHashes,omitempty"`',
      '  InputRealpaths map[string]*string `json:"inputRealpaths,omitempty"`',
      "}",
      "",
      "type transformResult struct {",
      '  TypeScript   map[string]string   `json:"typescript"`',
      '  Dependencies map[string][]string `json:"dependencies,omitempty"`',
      '  Graph        *referenceGraph     `json:"graph,omitempty"`',
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
      '    fmt.Fprintf(os.Stderr, "perf-fixture: unknown command %q\\n", args[0])',
      "    return 2",
      "  }",
      "}",
      "",
      "func transform(args []string) int {",
      '  fs := flag.NewFlagSet("transform", flag.ContinueOnError)',
      "  fs.SetOutput(os.Stderr)",
      '  cwd := fs.String("cwd", "", "")',
      '  fs.String("tsconfig", "", "")',
      '  fs.String("plugins-json", "", "")',
      "  if err := fs.Parse(args); err != nil { return 2 }",
      "  root := *cwd",
      '  if root == "" { root, _ = os.Getwd() }',
      "",
      '  if logPath := os.Getenv("PLUGIN_RUN_LOG"); logPath != "" {',
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
      "  names := []string{}",
      "  for _, e := range entries {",
      '    if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") { continue }',
      "    names = append(names, e.Name())",
      "  }",
      "  sort.Strings(names)",
      "  for _, name := range names {",
      "    data, err := os.ReadFile(filepath.Join(srcDir, name))",
      "    if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '    ts["src/"+name] = string(data)',
      "  }",
      '  if os.Getenv("TTSC_PERF_EMIT_EXTERNAL") == "1" {',
      '    ts["node_modules/dep/index.d.ts"] = "export {};\\n"',
      "  }",
      "",
      "  result := transformResult{TypeScript: ts}",
      '  fanout, _ := strconv.Atoi(os.Getenv("TTSC_PERF_GRAPH_FANOUT"))',
      "  if fanout > 0 {",
      "    externals := make([]string, 0, fanout)",
      "    for j := 0; j < fanout; j++ {",
      '      externals = append(externals, fmt.Sprintf("node_modules/dep%d/index.d.ts", j))',
      "    }",
      "    edges := map[string][]string{}",
      "    deps := map[string][]string{}",
      "    candidates := map[string][]string{}",
      "    for i, name := range names {",
      '      key := "src/" + name',
      "      targets := []string{}",
      '      if os.Getenv("TTSC_PERF_PARTITION_EXTERNAL") == "1" {',
      "        targets = append(targets, externals[i%len(externals)])",
      "      } else {",
      "        if i+1 < len(names) {",
      '          targets = append(targets, "src/"+names[i+1])',
      "        }",
      "        targets = append(targets, externals...)",
      "      }",
      "      edges[key] = targets",
      "      deps[key] = targets",
      "      // A missing superseding probe, mirroring an unsuccessful",
      "      // module-resolution candidate the compiler records.",
      '      candidates[key] = []string{fmt.Sprintf("node_modules/dep%d/index.ts", i%fanout)}',
      "    }",
      "    result.Dependencies = deps",
      '    globalCount, _ := strconv.Atoi(os.Getenv("TTSC_PERF_GRAPH_GLOBALS"))',
      "    globals := []string{}",
      "    for j := 0; j < globalCount; j++ {",
      '      globals = append(globals, fmt.Sprintf("node_modules/global%d/index.d.ts", j))',
      "    }",
      "    result.Graph = &referenceGraph{",
      "      Edges:      edges,",
      "      Globals:    globals,",
      '      Configs:    []string{"tsconfig.json"},',
      "      Candidates: candidates,",
      "      InputHashes: map[string]*string{},",
      "      InputRealpaths: map[string]*string{},",
      "    }",
      "    addGraphInputProofs(result.Graph, root)",
      "  }",
      "",
      "  data, _ := json.Marshal(result)",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
      "}",
      "",
      "func addGraphInputProofs(graph *referenceGraph, root string) {",
      "  inputs := map[string]struct{}{}",
      "  for source, targets := range graph.Edges {",
      "    inputs[source] = struct{}{}",
      "    for _, target := range targets { inputs[target] = struct{}{} }",
      "  }",
      "  for _, input := range graph.Globals { inputs[input] = struct{}{} }",
      "  for _, input := range graph.Configs { inputs[input] = struct{}{} }",
      "  for source, candidates := range graph.Candidates {",
      "    inputs[source] = struct{}{}",
      "    for _, candidate := range candidates { inputs[candidate] = struct{}{} }",
      "  }",
      "  for input := range inputs { addGraphInputProof(graph, root, input) }",
      "}",
      "",
      "func addGraphInputProof(graph *referenceGraph, root, input string) {",
      "  file := filepath.FromSlash(input)",
      "  if !filepath.IsAbs(file) { file = filepath.Join(root, file) }",
      "  data, err := os.ReadFile(file)",
      "  if err != nil {",
      "    info, statErr := os.Stat(file)",
      "    if statErr != nil || !info.IsDir() {",
      "      graph.InputHashes[input] = nil",
      "      graph.InputRealpaths[input] = nil",
      "      return",
      "    }",
      '    data = []byte("ttsc:host-input:directory\\x00")',
      "  }",
      "  realpath, err := filepath.EvalSymlinks(file)",
      "  if err != nil { return }",
      "  absolute, err := filepath.Abs(realpath)",
      "  if err != nil { return }",
      "  digest := sha256.Sum256(data)",
      '  hash := fmt.Sprintf("%x", digest[:])',
      "  graph.InputHashes[input] = &hash",
      "  graph.InputRealpaths[input] = &absolute",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
}

/** Resolve the native `tsc` binary the in-process transform path expects. */
function resolveTscBinary(): string {
  const packageJson = requireFromTtsc.resolve("typescript/package.json");
  const platformPackageJson = createRequire(packageJson).resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
}
