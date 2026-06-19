/**
 * Reproduces the @ttsc/unplugin per-module cache cost on a synthetic project.
 *
 * The real Rollup plugin object (`unplugin.rollup(...)`) is driven directly
 * over a generated `N`-file project, mirroring how Rollup invokes `buildStart`
 * once and `transform` once per module. We count native plugin spawns
 * (whole-project re-transforms) and `fs.readFileSync` traffic to expose the
 * super-linear cost.
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
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

  if (failures.length !== 0) {
    console.error(
      `\nFAIL: the per-build cache re-transformed the project more than once:\n  ${failures.join("\n  ")}`,
    );
    process.exit(1);
  }
  console.log("\nOK: every build ran exactly one whole-project transform.");
}

function recordFailure(failures: string[], failure: string | undefined): void {
  if (failure !== undefined) {
    failures.push(failure);
  }
}

interface Adapter {
  rollup: (options: unknown) => {
    buildStart: (this: unknown) => void | Promise<void>;
    transformInclude: (this: unknown, id: string) => boolean;
    transform: (
      this: unknown,
      code: string,
      id: string,
    ) => unknown | Promise<unknown>;
  };
}

/**
 * Bundle the real adapter source with esbuild (keeping `ttsc`/`unplugin`
 * external) so the production transform pipeline runs unmodified without a
 * rebuilt `lib`.
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
  return mod.default as Adapter;
}

function requireFromUnplugin(specifier: string): unknown {
  return createRequire(path.join(root, "packages", "unplugin", "package.json"))(
    specifier,
  );
}

interface MeasureOptions {
  count: number;
  emitExternalKey: boolean;
}

async function measure(
  adapter: Adapter,
  options: MeasureOptions,
): Promise<string | undefined> {
  const project = createProject(options);
  const plugin = adapter.rollup({
    project: path.join(project, "tsconfig.json"),
  });
  const runLog = path.join(project, ".plugin-runs");

  // Warm-up build: pays the one-time Go plugin compile + native program load so
  // the timed run reflects steady-state per-module cost, not toolchain startup.
  await runBuild(plugin, project, runLog);

  const counter = instrumentReadFileSync();
  fs.writeFileSync(runLog, "");
  const started = process.hrtime.bigint();
  await runBuild(plugin, project, runLog);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  counter.restore();

  const pluginRuns = fs.existsSync(runLog)
    ? fs.readFileSync(runLog, "utf8").length
    : 0;
  const perFileReads = (counter.calls / options.count).toFixed(1);
  console.log(
    `  N=${String(options.count).padStart(3)}  ` +
      `pluginRuns=${String(pluginRuns).padStart(3)}  ` +
      `reads=${String(counter.calls).padStart(7)}  ` +
      `reads/file=${perFileReads.padStart(7)}  ` +
      `readMiB=${(counter.bytes / 1048576).toFixed(1).padStart(6)}  ` +
      `${elapsedMs.toFixed(0).padStart(6)}ms`,
  );

  const scenario = options.emitExternalKey ? "B" : "A";
  return pluginRuns === 1
    ? undefined
    : `scenario ${scenario} N=${options.count}: pluginRuns=${pluginRuns} (expected 1)`;
}

/**
 * Drive the real Rollup plugin like the bundler would: `buildStart` once, then
 * `transform` for every included module, in module order.
 */
async function runBuild(
  plugin: ReturnType<Adapter["rollup"]>,
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
  await plugin.buildStart.call(context);
  for (const id of projectModules(project)) {
    if (!plugin.transformInclude.call(context, id)) {
      continue;
    }
    await plugin.transform.call(context, fs.readFileSync(id, "utf8"), id);
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

/** Wrap `fs.readFileSync` to count calls and bytes for one timed build. */
function instrumentReadFileSync(): {
  calls: number;
  bytes: number;
  restore: () => void;
} {
  const original = fs.readFileSync;
  const counter = { calls: 0, bytes: 0, restore: () => undefined };
  (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = function (
    this: unknown,
    ...args: Parameters<typeof fs.readFileSync>
  ) {
    counter.calls += 1;
    const result = original.apply(this, args as never);
    // `.length` is bytes for a Buffer and characters for a string; either is a
    // fine order-of-magnitude signal for this experiment.
    counter.bytes += result.length;
    return result;
  } as typeof fs.readFileSync;
  counter.restore = () => {
    (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = original;
  };
  return counter;
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
  // The Go sidecar keys its extra output entry only when asked.
  process.env.TTSC_PERF_EMIT_EXTERNAL = options.emitExternalKey ? "1" : "0";
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
      '  "encoding/json"',
      '  "flag"',
      '  "fmt"',
      '  "os"',
      '  "path/filepath"',
      '  "strings"',
      ")",
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
      "  for _, e := range entries {",
      '    if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") { continue }',
      "    data, err := os.ReadFile(filepath.Join(srcDir, e.Name()))",
      "    if err != nil { fmt.Fprintln(os.Stderr, err); return 2 }",
      '    ts["src/"+e.Name()] = string(data)',
      "  }",
      '  if os.Getenv("TTSC_PERF_EMIT_EXTERNAL") == "1" {',
      '    ts["node_modules/dep/index.d.ts"] = "export {};\\n"',
      "  }",
      "",
      "  data, _ := json.Marshal(transformResult{TypeScript: ts})",
      "  fmt.Fprintln(os.Stdout, string(data))",
      "  return 0",
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
