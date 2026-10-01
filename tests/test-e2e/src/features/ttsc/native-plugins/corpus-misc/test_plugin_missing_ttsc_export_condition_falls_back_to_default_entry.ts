import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin resolution: without a `ttsc` export condition, resolution is
 * unchanged and falls back to the package's default entry.
 *
 * The negative twin of
 * `test_plugin_ttsc_export_condition_resolves_runtime_free_descriptor`. The
 * `ttsc`-condition branch in `PluginPackageResolution.ts::resolvePluginRequest`
 * is strictly opt-in: a package that does not declare a `ttsc` condition must
 * resolve exactly as before (through `require.resolve` to the default entry),
 * so the override cannot silently divert packages that never asked for it.
 *
 * 1. A `node_modules/barrel-plugin` package exposes `exports["."] =
 *    "./barrel.cjs"` (no conditions) where `barrel.cjs` throws on load.
 * 2. Run ttsc against a project that depends on it.
 * 3. Assert non-zero exit and the barrel's load-time error in stderr — proving
 *    resolution reached the default entry rather than being diverted.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc reaches a package default entry without a ttsc export condition and reports its deliberate barrel exception.
 * @evidence contracts/testing.md#independent-expectations The only exports entry names barrel.cjs, whose literal exception identifies evaluation.
 * @evidence contracts/testing.md#distinguishing-cases Absent opt-in condition is the negative twin of the runtime-free ttsc export-condition case.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI interprets a consumer package exports map, resolves the default entry and evaluates its throwing barrel. The literal barrel exception proves the selected package entry reaches evaluation; neither rule-unit calls nor an unused committed manifest establish that resolution.
 * @evidence contracts/e2e.md#shared-execution One temporary consumer and one invocation of the already built CLI suffice for this descriptor/discovery rejection. No native build is required or claimed; sharing the built launcher does not share mutable package exports, contributor modules or config absence across consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc reaches a package default entry without a ttsc export condition and reports its deliberate barrel exception. These assertions stay in test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry =
  () => {
    const root = commonJsProject(FixtureFiles.read("ttsc/plugin_missing_ttsc_export_condition_falls_back_to_default_entry/inputs-1"));
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
