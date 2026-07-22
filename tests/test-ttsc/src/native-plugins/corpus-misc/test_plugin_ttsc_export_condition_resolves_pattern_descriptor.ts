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
 * Verifies plugin corpus: ttsc resolves a patterned descriptor export.
 *
 * Exact-only export selection fell through to the runtime branch for valid
 * single-star subpaths, reintroducing the plugin self-hosting cycle. The
 * private `ttsc` condition must select and substitute the runtime-free
 * descriptor.
 *
 * 1. Package a plugin with patterned `ttsc` and default export targets.
 * 2. Compile through the real source-plugin corpus entrypoint.
 * 3. Assert the descriptor transform ran and the runtime branch did not load.
 */
export const test_plugin_ttsc_export_condition_resolves_pattern_descriptor =
  () => {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("pattern");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "pattern-plugin": "0.1.0" } }),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const packageRoot = path.join(root, "node_modules", "pattern-plugin");
    fs.mkdirSync(path.join(packageRoot, "descriptors"), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, "runtime"), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "pattern-plugin",
        version: "0.1.0",
        exports: {
          "./plugins/*.js": {
            ttsc: "./descriptors/*.cjs",
            default: "./runtime/*.cjs",
          },
        },
        ttsc: {
          plugin: {
            transform: "pattern-plugin/plugins/prefix.js",
            name: "prefix",
            prefix: "PATTERN:",
          },
        },
      }),
    );
    fs.writeFileSync(
      path.join(packageRoot, "descriptors", "prefix.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: context.plugin.name,
  source: path.resolve(
    context.dirname,
    "..",
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
      path.join(packageRoot, "runtime", "prefix.cjs"),
      `throw new Error("TTSC_TEST_PATTERN_RUNTIME_LOADED");\n`,
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stderr, /TTSC_TEST_PATTERN_RUNTIME_LOADED/);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"PATTERN:pattern"/);
  };
