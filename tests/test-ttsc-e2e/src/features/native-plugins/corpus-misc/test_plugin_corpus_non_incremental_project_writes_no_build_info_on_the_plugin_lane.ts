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
 * Verifies plugin corpus: a project that did not ask for build information does
 * not get any from the native plugin emit lane.
 *
 * The negative twin of
 * `test_plugin_corpus_incremental_project_writes_build_info_on_the_plugin_lane`.
 * `tsBuildInfoFile` names where build information would go; only `incremental`
 * or `composite` asks for it to be produced, which is the pair
 * `CompilerOptions.IsIncremental` tests. A predicate that keyed on the path
 * option instead — or one that simply routed every emit through tsgo's
 * incremental lane — would keep the positive case green while silently growing
 * a `.tsbuildinfo` in every ordinary plugin project, and paying for a snapshot
 * nothing reads on every build.
 *
 * 1. Build the same project on the same host, with `tsBuildInfoFile` declared and
 *    `incremental` absent.
 * 2. Run `ttsc --emit`.
 * 3. Assert the transformed JavaScript is emitted and no build information is.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises native emit without incremental build-information publication; asserts transformed JavaScript and absent configured build-information file, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins declaring tsBuildInfoFile without incremental must not create a side product; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_non_incremental_project_writes_no_build_info_on_the_plugin_lane entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is native emit without incremental build-information publication; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable driver-emit workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains transformed JavaScript and absent configured build-information file with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_non_incremental_project_writes_no_build_info_on_the_plugin_lane() {
    const root = commonJsProject(
      {
        "plugin.cjs": [
          `const path = require("node:path");`,
          `module.exports = (context) => ({`,
          `  name: "go-driver-emit-plugin",`,
          `  capabilities: { emitProvenance: true },`,
          `  source: ${JSON.stringify(nativePluginSource("driver-emit"))},`,
          `});`,
          ``,
        ].join("\n"),
        "src/main.ts": [
          `export const payload = { value: "before" };`,
          `console.log(payload.value);`,
          ``,
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugin.cjs" }],
          tsBuildInfoFile: "./.cache/app.tsbuildinfo",
        },
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /GO DRIVER EMIT PLUGIN/);
    assert.equal(
      fs.existsSync(path.join(root, ".cache", "app.tsbuildinfo")),
      false,
      "build information was written for a project that never asked for it",
    );
}
