import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies runner corpus: .cts entry executes through CommonJS output.
 *
 * In a `type: "module"` package, `.ts` files are treated as ESM. `.cts` is the
 * explicit CJS override. ttsx must detect the `.cts` extension and load the
 * corresponding `.cjs` emit via `require()` rather than dynamic `import()`.
 *
 * 1. Create a `type: "module"` project with a `.cts` entry.
 * 2. Run ttsx against the `.cts` entry.
 * 3. Assert it exits successfully and prints the expected output.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx runs a typed CTS entry in a type-module NodeNext package; status zero and exact cts-runner-ok detect an unusable extension-to-runtime-format handoff.
 * @evidence contracts/testing.md#independent-expectations The authored string is literal; NodeNext CTS is the explicit CommonJS override despite type module. Success does not itself prove the implementation used require rather than a correct facade.
 * @evidence contracts/testing.md#distinguishing-cases Contrary package type and explicit CTS extension are this entry distinction; RuntimeModuleFormat units own the portable suffix/package decision matrix.
 * @evidence contracts/testing.md#execution-ownership This named E2E export is selected with runtime features and starts the real launcher/compiler/Node connection; no fixture script is an assertion host.
 * @evidence contracts/e2e.md#necessary-boundary Actual CTS emit and Node entry loading must connect under contrary package type; direct classification does not certify emitted code is executable.
 * @evidence contracts/e2e.md#shared-execution One immutable project and one host reuse the installed compiler. This standalone root preparation remains a consolidation candidate; it is not described as already the minimum suite batch.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The source/config/package identity stays fixed throughout synchronous child completion, and TestProject owns temporary cleanup; no warm or invalidated cache transition is claimed.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status and exact cts-runner-ok remain here; no format-classifier unit is claimed to execute this main-module transport.
 */
export function test_runner_corpus_cts_entry_executes_through_commonjs_output() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/runner_corpus_cts_entry_executes_through_commonjs_output/inputs-1"));

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.cts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "cts-runner-ok");
  }
