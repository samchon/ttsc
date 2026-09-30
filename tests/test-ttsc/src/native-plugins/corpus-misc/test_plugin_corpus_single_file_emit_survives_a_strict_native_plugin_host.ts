import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  nativePluginSource,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: single-file emit works on a native host that never
 * declared `--tsgo-args`.
 *
 * The widest instance of issue #1188, and the one that needs no flag from the
 * user at all. `runSingleFileEmit` compiles into a private temp directory and
 * asks tsgo to keep every side product there, so `isolatedTsgoOutputArgs`
 * always contributes `--outFile null --declarationDir null --tsBuildInfoFile
 * null --outDir <tmp>` to the forwarded payload. While that payload travelled
 * as a `--tsgo-args` CLI flag, plain `ttsc <file.ts>` therefore exited 2 on
 * every project carrying a typia/nestia-shaped transform host — ttsc's own
 * containment flags crashed the sidecar. Keeping this case separate from the
 * user-forwarded one matters because only this one proves the launcher's own
 * injected payload is delivered safely.
 *
 * 1. Build a project on the strict `go-driver-emit-plugin` host.
 * 2. Run `ttsc src/main.ts` with no flag of any kind.
 * 3. Assert zero exit, the resolved output path on stdout, and the transformed
 *    JavaScript in that file.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises single-file isolation arguments reaching a strict native host; asserts zero exit, no unknown-flag error, stdout output path and transformed JavaScript, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins launcher-generated containment flags work without user-supplied forwarding flags; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_single_file_emit_survives_a_strict_native_plugin_host entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is single-file isolation arguments reaching a strict native host; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable driver-emit workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains zero exit, no unknown-flag error, stdout output path and transformed JavaScript with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_single_file_emit_survives_a_strict_native_plugin_host() {
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
        },
      },
    );

    const result = spawn(
      ttscBin,
      ["--cwd", root, path.join("src", "main.ts")],
      {
        cwd: root,
        env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(
      `${result.stdout}${result.stderr}`,
      /flag provided but not defined/,
    );
    // The emit lane reports the file it resolved; the transform proves the
    // sidecar actually ran rather than the launcher falling back to plain tsgo.
    assert.match(result.stdout.replace(/\\/g, "/"), /dist\/main\.js/);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /GO DRIVER EMIT PLUGIN/);
}
