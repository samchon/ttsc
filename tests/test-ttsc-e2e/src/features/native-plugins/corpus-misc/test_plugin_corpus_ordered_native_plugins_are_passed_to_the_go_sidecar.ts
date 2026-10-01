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
 * Verifies plugin corpus: ordered native plugins are passed to the Go sidecar.
 *
 * The `--plugins-json` payload forwarded to the native binary must preserve
 * tsconfig order and honour the `enabled: false` flag. Enabled plugins that
 * carry `prefix`/`suffix` options compose in declaration order; a disabled
 * plugin (`enabled: false`) must be silently dropped so its suffix never
 * appears in the output.
 *
 * 1. Configure four native plugins: prefix `A:`, a disabled suffix `:NO`, an
 *    identity plugin, and a suffix `:Z`.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and the emitted JS contains `"A:PLUGIN:Z"` (with no `:NO`
 *    from the disabled entry).
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises ordered plugins-json transport; asserts zero exit and the literal transformed value A:PLUGIN:Z, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins enabled prefix/identity/suffix entries retain order while the disabled suffix contributes nothing; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_ordered_native_plugins_are_passed_to_the_go_sidecar entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is ordered plugins-json transport; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit and the literal transformed value A:PLUGIN:Z with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_ordered_native_plugins_are_passed_to_the_go_sidecar() {
    const root = pluginProject(
      [
        { transform: "./plugins/prefix.cjs", name: "prefix", prefix: "A:" },
        {
          transform: "./plugins/disabled.cjs",
          name: "disabled",
          enabled: false,
          suffix: ":NO",
        },
        { transform: "./plugins/upper.cjs", name: "upper" },
        { transform: "./plugins/suffix.cjs", name: "suffix", suffix: ":Z" },
      ],
      {
        "plugins/prefix.cjs": nativePlugin(),
        "plugins/disabled.cjs": nativePlugin(),
        "plugins/upper.cjs": nativePlugin(),
        "plugins/suffix.cjs": nativePlugin(),
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"A:PLUGIN:Z"/);
}
