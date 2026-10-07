import { TestProject } from "@ttsc/testing";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  createFakeNativePreview,
  createProject,
} from "../../../internal/ttsc/internal/toolchain";
import { case_consumer_compiler_preserves_external_emit_provenance } from "./case_consumer_compiler_preserves_external_emit_provenance";

/**
 * Executes the converted provenance matrix with its own scripted consumer. This
 * is an unconsolidated process control for the new actual-import boundary, not
 * an instrumented execution of the former extracted-function unit.
 *
 * 1. Copy the same authored 41 profiles and source/config/response inputs.
 * 2. Install the original native script launcher for recorder.cjs.
 * 3. Run the built adapter's original row assertions on that selected executable.
 *
 * @evidence contracts/testing.md#behavioral-verification The same actual-import owner checks writer1, argv/prefix/listing, status7, literal stderr, physical singleton-or-empty attribution and refusals for every original named row.
 * @evidence contracts/testing.md#independent-expectations Uses the unchanged authored profiles and recorder bytes, with native realpath identity; no expected output or refusal is constructed by this preparation entry.
 * @evidence contracts/testing.md#distinguishing-cases All41 admission and refusal rows remain in their owning case, including malformed, missing, ambiguous and response-frame inputs.
 * @evidence contracts/testing.md#execution-ownership Exact control selection is explicit through the legacy runner's positive TTSC_TEST_DIRS path. The old AST-only unit remains separate and this new body is authored/unexecuted, not original686 completion.
 * @evidence contracts/e2e.md#necessary-boundary The actually imported adapter's private readonly probes and emission reach one real scripted native executable; extracted source functions do not establish that process connection.
 * @evidence contracts/e2e.md#shared-execution One separate original provenance consumer serves all41 rows. With the separate forwarding donor this supplies the unconsolidated preparation contrast to one shared dispatcher consumer; it is not a historical legacy process-count baseline for the old unit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The retained private root contains only this control's profiles and package. The existing case owns synchronous profile mutation guards and restoration; selected-file and direct-child observations do not certify arbitrary descendants or loaded images.
 * @evidence contracts/e2e.md#preserved-coverage Calls the same41-row owner without changing row names or assertions. Both original forwarding and AST-only donors remain. Actual selected coverage and converted-boundary comparison remain pending, and their process totals must not be mixed with historical legacy totals.
 */
export function test_consumer_compiler_preserves_external_emit_provenance_process_control(): void {
  const root = createProject(
    FixtureFiles.read("ttsc/compiler/consumer-provenance"),
  );
  TestProject.retainTemporaryDirectory(
    root,
    "Converted provenance control inputs retained for actual probe observation",
  );
  createFakeNativePreview(
    root,
    `require(${JSON.stringify(path.join(root, "recorder.cjs"))});`,
  );
  const binary = path.join(
    root,
    "node_modules",
    "@typescript",
    `typescript-${process.platform}-${process.arch}`,
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
  case_consumer_compiler_preserves_external_emit_provenance(
    root,
    binary,
    process.env,
  );
}
