import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  goPath,
  nativePlugin,
  path,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: `--noEmit` does not break a native plugin check.
 *
 * Pins the compatibility regression found while benchmarking typia/nestia
 * consumers: `runBuild` used to translate `ttsc --noEmit` into a native host
 * `check` invocation with extra ttsc-owned flags like `--noEmit` and `--quiet`.
 * Third-party transform hosts already use the `check` subcommand to mean no
 * emit, and older strict hosts reject the extra flags before analysis starts.
 *
 * 1. Configure a native transform plugin backed by the strict test sidecar.
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert the sidecar accepts the check invocation and exits cleanly.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises strict native check command assembly; asserts zero exit from the strict native host, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins the noEmit request selects check without inventing native CLI flags; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_no_emit_flag_does_not_break_a_native_plugin_check entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is strict native check command assembly; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit from the strict native host with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_no_emit_flag_does_not_break_a_native_plugin_check() {
    const root = pluginProject(
      [{ transform: "./plugins/upper.cjs", name: "upper" }],
      {
        "plugins/upper.cjs": nativePlugin(),
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
}
