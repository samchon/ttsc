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
 * Verifies plugin corpus: an `incremental` project gets its `tsBuildInfoFile`
 * even when a native plugin owns the emit.
 *
 * The other half of issue #1188. tsgo writes build information from
 * `performIncrementalCompilation`, a branch inside its CLI that a host building
 * its Program through `driver.LoadProgram` never reaches, so `incremental` and
 * `tsBuildInfoFile` parsed cleanly and were then discarded: the build emitted
 * JavaScript, exited 0, and produced no `.tsbuildinfo` at all. The reporter's
 * CI keyed its compiled-output cache on that file and recompiled every run.
 *
 * The host here is `go-driver-emit-plugin`, which emits through
 * `EmitWithPluginTransformers` — the hand-assembled lane typia uses, and the
 * one that needs its own build-information pass because its JavaScript never
 * goes through tsgo's emitter.
 *
 * 1. Build a project on that host with `incremental` and a `tsBuildInfoFile`
 *    outside `outDir`.
 * 2. Run `ttsc --emit`.
 * 3. Assert the transformed JavaScript and a versioned build-information document
 *    at exactly the configured path.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises native emit with incremental build-information publication; asserts transformed JavaScript and a configured build-information document with a string version, distinguishing lost delivery or incorrect assembly from valid compilation.
 * @evidence contracts/testing.md#independent-expectations Literal fixture transforms and the public compiler option/export contracts establish the expected result; expected output is not generated from the launcher under test.
 * @evidence contracts/testing.md#distinguishing-cases This case pins incremental enables publication outside outDir at the configured path; other corpus cases retain cold builds, source mutation, descriptor identity and failed native compilation.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_incremental_project_writes_build_info_on_the_plugin_lane entry executes from native-plugins/corpus-misc in the Linux E2E population; it starts the actual launcher and native producer.
 * @evidence contracts/e2e.md#necessary-boundary The real connection is native emit with incremental build-information publication; direct calls cannot prove descriptor-process, launcher and native-host protocol agreement.
 * @evidence contracts/e2e.md#shared-execution Reuses the immutable driver-emit workspace source and shared content-addressed plugin cache with other corpus consumers, avoiding a fresh Go module copy per scenario; a separate CLI invocation is required by this invocation's arguments or descriptor selection.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This case owns its temporary consumer project and outputs while the canonical Go source remains read-only. Exact source, toolchain and host inputs key the shared binary; no cold-build or invalidation assertion uses this warm fixture. TestProject removes temporary consumer state at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retains transformed JavaScript and a configured build-information document with a string version with the same fixture meaning; only duplicate native source materialization is removed, with source mutation and cache transitions owned by their existing isolated cases.
 */
export function test_plugin_corpus_incremental_project_writes_build_info_on_the_plugin_lane() {
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
          incremental: true,
          plugins: [{ transform: "./plugin.cjs" }],
          // Deliberately outside `outDir`: that is tsgo's own default
          // neighbourhood for the file, and the placement
          // `driver/emit_containment.go` exempts from the outDir guard.
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

    const buildInfoPath = path.join(root, ".cache", "app.tsbuildinfo");
    assert.ok(
      fs.existsSync(buildInfoPath),
      "tsBuildInfoFile was not written by the native plugin emit lane",
    );
    // A file a consumer can read back, not merely a file that exists: tsgo
    // rejects build information whose recorded compiler version it cannot
    // match, so the version field is what makes the artifact usable.
    const buildInfo = JSON.parse(
      fs.readFileSync(buildInfoPath, "utf8"),
    ) as Record<string, unknown>;
    assert.equal(typeof buildInfo.version, "string");
}
