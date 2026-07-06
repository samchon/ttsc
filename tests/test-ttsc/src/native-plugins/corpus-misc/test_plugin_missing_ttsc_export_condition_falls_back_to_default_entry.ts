import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin resolution: without a `ttsc` export condition, resolution is
 * unchanged and falls back to the package's default entry.
 *
 * The negative twin of
 * `test_plugin_ttsc_export_condition_resolves_runtime_free_descriptor`. The
 * `ttsc`-condition branch in `loadProjectPlugins.ts::resolvePluginRequest` is
 * strictly opt-in: a package that does not declare a `ttsc` condition must
 * resolve exactly as before (through `require.resolve` to the default entry),
 * so the override cannot silently divert packages that never asked for it.
 *
 * 1. A `node_modules/barrel-plugin` package exposes `exports["."] =
 *    "./barrel.cjs"` (no conditions) where `barrel.cjs` throws on load.
 * 2. Run ttsc against a project that depends on it.
 * 3. Assert non-zero exit and the barrel's load-time error in stderr — proving
 *    resolution reached the default entry rather than being diverted.
 */
export const test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry =
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

    const packageRoot = path.join(root, "node_modules", "barrel-plugin");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "barrel-plugin",
        version: "0.1.0",
        // No `ttsc` condition: the only entry is the barrel, so resolution must
        // fall through to it via the normal `require.resolve`.
        exports: {
          ".": "./barrel.cjs",
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
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TTSC_TEST_RUNTIME_BARREL_LOADED/);
  };
