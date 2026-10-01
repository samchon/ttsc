import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies ttsc utility plugins: removed output stage descriptor is rejected.
 *
 * The `"output"` plugin stage was removed in an earlier release. Descriptors
 * that still declare `stage: "output"` must be rejected by the loader with an
 * explicit error, so authors receive a clear migration message instead of a
 * silent no-op or a crash inside the Go host.
 *
 * 1. Create a project whose plugin descriptor uses `stage: "output"`.
 * 2. Run `ttsc --emit`.
 * 3. Assert a non-zero exit and the `removed stage "output"` diagnostic in stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsc --emit command rejects a legacy output-stage descriptor with a nonzero exit and removed-stage diagnostic.
 * @evidence contracts/testing.md#independent-expectations The supported protocol removed stage output; the authored legacy descriptor therefore requires this explicit rejection before native execution.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a project whose plugin descriptor uses `stage: "output"`. 2. Run `ttsc --emit`. 3. Assert a non-zero exit and the `removed stage "output"` diagnostic in stderr.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/utility-plugins entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The actual child or host operation exercises the transport and execution result named in this case; direct in-process decision helpers cannot establish that process outcome.
 * @evidence contracts/e2e.md#shared-execution All authored subcases reuse the fixture and available runtime within this named entry; distinct process results or runtime identities retain their required child lifetime, without a consumer installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject fixtures isolate mutable records and runtime identities. Synchronous child completion or existing session cleanup owns process lifetime; temporary roots remain registered with TestProject for exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The real ttsc --emit command rejects a legacy output-stage descriptor with a nonzero exit and removed-stage diagnostic. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_ttsc_utility_plugins_removed_output_stage_descriptor_is_rejected =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
        "plugins/output.cjs": `
        module.exports = (context) => ({
          name: "legacy-output",
          source: require("node:path").resolve(context.dirname, "..", "plugin"),
          stage: "output",
        });
      `,
        "plugin/go.mod": "module example.com/legacyoutput\n\ngo 1.26\n",
        "plugin/main.go": "package main\n\nfunc main() {}\n",
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/output.cjs" }],
        },
      },
    );
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      { cwd: root },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /removed stage "output"/);
  };
