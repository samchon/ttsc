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
 * Verifies plugin corpus: custom outDir receives Go native output.
 *
 * The `--outDir` CLI flag must be forwarded into the Go sidecar invocation so
 * that plugin-transformed JS lands in the overridden directory rather than the
 * `outDir` recorded in tsconfig. Without this forwarding a custom output path
 * silently falls back to the tsconfig value.
 *
 * 1. Configure a native plugin project whose tsconfig uses the default `dist/`.
 * 2. Run ttsc with `--emit --outDir custom`.
 * 3. Assert zero exit and the emitted `main.js` (containing `"PLUGIN"`) appears
 *    under `custom/` rather than `dist/`.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises CLI outDir forwarding to the Go sidecar; asserts the exit status and custom/main.js containing PLUGIN, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins a custom output directory overrides tsconfig dist; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_custom_outdir_receives_go_native_output entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is CLI outDir forwarding to the Go sidecar; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable transformer workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains the exit status and custom/main.js containing PLUGIN with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_custom_outdir_receives_go_native_output() {
    const root = pluginProject(
      [{ transform: "./plugins/out.cjs", name: "out" }],
      {
        "plugins/out.cjs": nativePlugin(),
      },
    );
    const output = path.join(root, "custom", "main.js");

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--outDir", "custom"],
      {
        cwd: root,
        env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(output, "utf8"), /"PLUGIN"/);
}
