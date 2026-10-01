import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  nativePlugin,
  path,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: `--singleThreaded` does not break a native plugin
 * build.
 *
 * Pins the compatibility regression from #113: `runBuild` used to forward
 * `--singleThreaded` / `--checkers` to native plugin hosts as bare CLI flags. A
 * third-party host built before #113 has no such flag in its `flag.FlagSet`,
 * and a host that parses with `flag.ContinueOnError` exits 2 on the unknown
 * flag instead of ignoring it — so `ttsc --singleThreaded` failed
 * deterministically on any project carrying a typia/nestia transform plugin.
 * The threading knobs are ttsc-owned and now stay on the no-plugin `tsgo` lane;
 * native hosts never see them. The `go-transformer` fixture is a deliberately
 * strict host (`flag.ContinueOnError`, no `singleThreaded` flag), so it
 * reproduces the exact crash.
 *
 * 1. Configure a native plugin backed by the strict `go-transformer` host.
 * 2. Run ttsc with `--emit --singleThreaded`.
 * 3. Assert zero exit and the emitted JS still contains the transformed value.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises launcher threading option ownership; asserts zero exit and transformed PLUGIN output, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins singleThreaded remains launcher-owned instead of an unsupported host argument; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_single_threaded_flag_does_not_break_a_native_plugin_build entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is launcher threading option ownership; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit and transformed PLUGIN output with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_single_threaded_flag_does_not_break_a_native_plugin_build() {
    const root = pluginProject(
      [{ transform: "./plugins/upper.cjs", name: "upper" }],
      {
        "plugins/upper.cjs": nativePlugin(),
      },
    );

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--singleThreaded"],
      {
        cwd: root,
        env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"PLUGIN"/);
}
