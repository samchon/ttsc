import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { adapter, deadline, eventually, workspace, write } from "./common.mjs";

/**
 * The linked contributor every predicate project shares, so the utility host it
 * links into is built once per install and cached across hosts.
 */
function predicateProbe() {
  const module = path.join(workspace, ".contracts", "predicate-probe");
  write(module, "go.mod", "module example.com/ttscpredicates\n\ngo 1.26\n");
  write(
    module,
    "compile-probe/probe.go",
    [
      "package predicateprobe",
      "",
      "import (",
      '  "os"',
      '  "path/filepath"',
      "",
      '  "github.com/samchon/ttsc/packages/ttsc/driver"',
      ")",
      "",
      "type plugin struct{}",
      "",
      "func (plugin) ApplyProgram(_ *driver.Program, context driver.PluginContext) error {",
      '  runLog, _ := context.Entry.Config["runLog"].(string)',
      "  if err := os.MkdirAll(filepath.Dir(runLog), 0o755); err != nil {",
      "    return err",
      "  }",
      "  file, err := os.OpenFile(runLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)",
      "  if err != nil {",
      "    return err",
      "  }",
      "  if _, err := file.Write([]byte{1}); err != nil {",
      "    _ = file.Close()",
      "    return err",
      "  }",
      "  return file.Close()",
      "}",
      "",
      "func init() {",
      "  driver.RegisterPlugin(plugin{})",
      "}",
      "",
    ].join("\n"),
  );
  return path.join(module, "compile-probe");
}

/**
 * A project whose compile records the predicates a host channel must observe
 * (samchon/ttsc#1388): a type reference resolved past a missing `@types`
 * directory, and package directories checked only to exist. Its `include`
 * admits `src`, whose root files no compiler predicate reports: the project's
 * root-file membership reaches the host instead (samchon/ttsc#1419).
 *
 * Its plugin is a linked contributor with no transform, so its compile goes
 * through TypeScript-Go's program and reports the full graph, and its
 * `ApplyProgram` appends one byte per compile. The sources stay JavaScript so
 * every host parses them without a TypeScript loader.
 */
function predicateFixture(name) {
  const root = path.join(workspace, ".contracts", `predicates-${name}`);
  assert.equal(path.dirname(root), path.join(workspace, ".contracts"));
  fs.rmSync(root, { recursive: true, force: true });
  const runLog = path.join(root, ".ttsc", "program-runs");
  write(
    root,
    "plugin.cjs",
    `module.exports = () => ({ name: "predicate-probe", source: ${JSON.stringify(predicateProbe())} });\n`,
  );
  write(
    root,
    "package.json",
    JSON.stringify({ private: true, type: "module" }),
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        plugins: [{ transform: "./plugin.cjs", runLog }],
      },
      include: ["src"],
    }),
  );
  write(
    root,
    "node_modules/typed-dep/package.json",
    JSON.stringify({ name: "typed-dep", types: "dist/index.d.ts" }),
  );
  write(
    root,
    "node_modules/typed-dep/dist/index.d.ts",
    "declare const typedDep: string;\n",
  );
  const entry = path.join(root, "src", "main.ts");
  write(
    root,
    "src/main.ts",
    [
      '/// <reference types="typed-dep" />',
      'export const value = "predicates";',
      "console.log(value);",
      "",
    ].join("\n"),
  );
  return {
    entry,
    options: { project: path.join(root, "tsconfig.json") },
    output: path.join(root, "dist-contract", "bundle.js"),
    root,
    runs: () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0),
  };
}

/**
 * Build the shared linked host once, outside any host's deadline: its first
 * build compiles the utility host and can take minutes on a cold Go cache.
 */
export async function warmPredicateProbe() {
  const api = await import("@ttsc/unplugin/api");
  const project = predicateFixture("warm");
  await api.transformTtsc(
    project.entry,
    fs.readFileSync(project.entry, "utf8"),
    api.resolveOptions(project.options),
  );
  assert.equal(project.runs(), 1, "the predicate probe compiles");
}

/**
 * Drive the predicate matrix through one watching host (samchon/ttsc#1388).
 *
 * `start` opens the host's watch session on the fixture and calls `built` once
 * per completed build. It returns the session's `close`, and `poke` for a host
 * whose watcher is driven by hand. A write the compiler never observed must
 * start no build. A missing directory's creation and a new root file in the
 * included directory must each recompile the project.
 */
export async function predicateContract(name, start) {
  const project = predicateFixture(name);
  let builds = 0;
  const plugin = await adapter(name, project.options);
  const session = await start(project, plugin, () => {
    builds += 1;
  });
  const runs = async () => {
    await session.poke?.();
    return project.runs();
  };
  const settle = (label) =>
    // Hosts may repeat an initial build while their watcher starts.
    eventually(
      async () => {
        const before = builds;
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        return builds === before;
      },
      (quiet) => quiet,
      label,
    );
  try {
    await eventually(runs, (count) => count === 1, `${name} first compile`);
    await settle(`${name} initial builds settle`);
    const quiet = builds;

    write(project.root, "node_modules/typed-dep/dist/unrelated.txt", "x");
    write(project.root, "node_modules/.vitest-cache/results.json", "{}");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await session.poke?.();
    assert.equal(
      builds,
      quiet,
      `${name}: a write the compiler never observed starts no build`,
    );
    assert.equal(project.runs(), 1);

    write(
      project.root,
      "node_modules/@types/typed-dep/index.d.ts",
      "declare const typedDep: string;\n",
    );
    await eventually(
      runs,
      (count) => count === 2,
      `${name}: a created @types directory that supersedes a resolution recompiles`,
    );
    await settle(`${name} missing-path rebuild settles`);

    const listed = builds;
    const signaled = session.signals?.();
    write(project.root, "src/contract-extra.d.ts", "declare const extra: 1;\n");
    // A timeout names the stalled side: an unchanged sentinel means the bridge
    // never heard the entry, a changed one without a build means the host
    // missed the signal, and a build without a compile means the generation
    // was judged unchanged.
    await eventually(
      runs,
      (count) => count === 3,
      `${name}: a new root file in the included directory recompiles`,
    ).catch((error) => {
      const sentinels =
        signaled === undefined
          ? ""
          : `, sentinels ${JSON.stringify(signaled)} -> ${JSON.stringify(session.signals())}`;
      throw new Error(
        `${error.message} (${builds - listed} build(s) since the entry appeared${sentinels})`,
      );
    });
  } finally {
    await deadline(Promise.resolve(session.close()), `${name} predicate close`);
  }
}

/** Rollup and Rolldown watch sessions. */
export function watchRollupLike(bundlerName) {
  return async (project, plugin, built) => {
    const bundler = await import(bundlerName);
    // The bridge's sentinels the last build watched, for a timeout to report.
    let sentinels = [];
    const watcher = bundler.watch({
      input: project.entry,
      plugins: [plugin],
      output: { file: project.output, format: "esm" },
      watch: { clearScreen: false },
    });
    watcher.on("event", async (event) => {
      if (event.code === "BUNDLE_END") {
        if (bundlerName === "rollup") {
          // One watcher per registered path is Rollup's cost, so nothing the
          // compiler observed may reach it directly.
          assert.deepEqual(
            event.result.watchFiles.filter((file) =>
              file.includes(`${path.sep}node_modules${path.sep}`),
            ),
            [],
            "Rollup must watch no compiler input below node_modules",
          );
        }
        sentinels =
          event.result?.watchFiles?.filter((file) =>
            file.endsWith(".signal"),
          ) ?? sentinels;
        await event.result?.close();
        built();
      }
      if (event.code === "ERROR") built();
    });
    return {
      close: () => watcher.close(),
      signals: () =>
        sentinels.map((file) => {
          try {
            return fs.readFileSync(file, "utf8");
          } catch {
            return null;
          }
        }),
    };
  };
}

/** An esbuild watch context. */
export async function watchEsbuild(project, plugin, built) {
  const esbuild = await import("esbuild");
  const context = await esbuild.context({
    absWorkingDir: project.root,
    entryPoints: [project.entry],
    bundle: true,
    write: false,
    format: "esm",
    logLevel: "silent",
    plugins: [plugin, { name: "count", setup: (build) => build.onEnd(built) }],
  });
  await context.watch();
  return { close: () => context.dispose() };
}

/** A webpack or Rspack watching compiler. */
export function watchWebpackLike(name) {
  return async (project, plugin, built) => {
    const bundler =
      name === "webpack"
        ? (await import("webpack")).default
        : (await import("@rspack/core")).rspack;
    const compiler = bundler({
      context: project.root,
      mode: "development",
      devtool: false,
      entry: project.entry,
      output: { path: path.dirname(project.output), filename: "bundle.js" },
      module: { rules: [{ test: /\.ts$/, type: "javascript/auto" }] },
      resolve: { extensions: [".ts", ".js"] },
      plugins: [plugin],
    });
    const watcher = compiler.watch({}, () => built());
    return {
      close: () =>
        new Promise((resolve) =>
          watcher.close(() => compiler.close(() => resolve())),
        ),
    };
  };
}

/**
 * A Farm development compiler. Its dev server's watcher reports a changed extra
 * watch file to `Compiler.update`; the contract does the same for the sentinels
 * the bridge rewrites.
 */
export async function watchFarm(project, plugin, built) {
  const farm = await import("@farmfe/core");
  const logger = new farm.Logger({ exit: false });
  const resolved = await farm.resolveConfig(
    {
      root: project.root,
      configFile: false,
      compilation: {
        input: { main: "./src/main.ts" },
        output: { path: "./dist-contract", targetEnv: "node", format: "esm" },
        minify: false,
        persistentCache: false,
        lazyCompilation: false,
        progress: false,
      },
      plugins: [plugin],
    },
    "development",
    logger,
  );
  const compiler = await farm.createCompiler(resolved, logger);
  await compiler.compile();
  built();
  const signals = new Map();
  const read = (file) => {
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return undefined;
    }
  };
  for (const watched of compiler.resolvedWatchPaths()) {
    const file = path.resolve(project.root, watched);
    if (file.endsWith(".signal")) signals.set(file, read(file));
  }
  return {
    close: () => undefined,
    async poke() {
      const changed = [];
      for (const [file, seen] of signals) {
        const now = read(file);
        if (now !== seen) {
          signals.set(file, now);
          changed.push(file);
        }
      }
      if (changed.length === 0) return;
      await compiler.update(changed);
      built();
    },
  };
}
