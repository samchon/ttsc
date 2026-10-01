import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises patterned ttsc export resolution and native descriptor loading; asserts zero exit, no runtime-branch exception and literal PATTERN:pattern output, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins single-star substitution selects the descriptor instead of the default runtime target; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_ttsc_export_condition_resolves_pattern_descriptor entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is patterned ttsc export resolution and native descriptor loading; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit, no runtime-branch exception and literal PATTERN:pattern output with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_ttsc_export_condition_resolves_pattern_descriptor() {
    const root = commonJsProject({
      "src/main.ts": `export const value: string = goUpper("pattern");\nconsole.log(value);\n`,
    });
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: { "pattern-plugin": "0.1.0" } }),
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
  source: ${JSON.stringify(nativePluginSource())},
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
}
