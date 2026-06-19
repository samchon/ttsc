import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  copyDirectory,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin resolution: a `ttsc` export condition selects a runtime-free
 * descriptor over the package's default barrel entry.
 *
 * Locks the `ttsc`-condition branch added to
 * `loadProjectPlugins.ts::resolvePluginRequest`. A package whose `.` entry is a
 * runtime barrel (the real case is `typia`, whose index re-exports the whole
 * validator runtime) cannot serve as the plugin descriptor entry — loading it
 * during plugin bootstrap pulls the runtime in and, for a self-hosting
 * transform, deadlocks. The package opts in with a `ttsc` export condition that
 * points at a runtime-free descriptor; ttsc must resolve the descriptor and
 * never touch the barrel.
 *
 * 1. A `node_modules/barrel-plugin` package exposes `exports["."] = { ttsc:
 *    "./descriptor.cjs", default: "./barrel.cjs" }`, where `barrel.cjs` throws
 *    on load and `descriptor.cjs` is a valid factory.
 * 2. Run ttsc with `--emit` against a project that depends on it.
 * 3. Assert zero exit, the descriptor's transform ran (`"TTSCCOND:plugin"` in the
 *    emit), and the barrel's load-time error never appears.
 */
export const test_plugin_ttsc_export_condition_resolves_runtime_free_descriptor =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("plugin");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "barrel-plugin": "0.1.0",
        },
      }),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const packageRoot = path.join(root, "node_modules", "barrel-plugin");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "barrel-plugin",
        version: "0.1.0",
        // The default `.` entry is the runtime barrel; the `ttsc` condition
        // points at the runtime-free descriptor that ttsc must pick instead.
        exports: {
          ".": {
            ttsc: "./descriptor.cjs",
            default: "./barrel.cjs",
          },
        },
        ttsc: {
          plugin: {
            transform: "barrel-plugin",
            name: "prefix",
            prefix: "TTSCCOND:",
          },
        },
      }),
    );
    fs.writeFileSync(
      path.join(packageRoot, "descriptor.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: path.resolve(
    context.dirname,
    "..",
    "..",
    "go-plugin",
    "cmd",
    "ttsc-go-transformer"
  ),
});
`,
    );
    fs.writeFileSync(
      path.join(packageRoot, "barrel.cjs"),
      `throw new Error("TTSC_TEST_RUNTIME_BARREL_LOADED");\n`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stderr, /TTSC_TEST_RUNTIME_BARREL_LOADED/);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"TTSCCOND:plugin"/);
  };
