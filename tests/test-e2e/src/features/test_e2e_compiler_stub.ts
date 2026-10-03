import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";

import { FixtureFiles } from "../internal/FixtureFiles";
import { case_consumer_compiler_preserves_external_emit_provenance } from "./ttsc/compiler/case_consumer_compiler_preserves_external_emit_provenance";
import { test_compiler_consumer_local_native_compiler_receives_the_launcher_contract } from "./ttsc/compiler/test_compiler_consumer_local_native_compiler_receives_the_launcher_contract";

/**
 * Executes launcher forwarding and 41 provenance rows on one scripted consumer.
 * The original native script wrapper is installed once. Its immutable dispatcher
 * runs the forwarding contract until an authored provenance profile is present,
 * then delegates to the original recorder on that same executable path.
 *
 * 1. Copy the forwarding fixture and exact provenance inputs into one consumer.
 * 2. Install the dispatcher once and run the original three universal/POSIX fourth requests.
 * 3. Restore the authored provenance config and run all 41 admission/ownership rows.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual launchers retain noEmit/emit/tsx/version argv, log, output and mode assertions; the actually imported built adapter retains all41 status7/stderr/source-ownership/refusal rows.
 * @evidence contracts/testing.md#independent-expectations Original single-pass/consumer-local-tsgo/NONEXEC literals and unchanged profiles.json row names establish distinct expected behavior; the source-should-not-run control remains.
 * @evidence contracts/testing.md#distinguishing-cases Original noEmit versus emit, runtime execution versus source, POSIX mode repair and all admission/refusal/source suffix variants remain real requests against one immutable dispatcher.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated compiler-stub family owns one consumer and native wrapper; original bodies retain their named assertions instead of being independently prepared by recursive discovery.
 * @evidence contracts/e2e.md#necessary-boundary Launcher and adapter readonly probes must reach the actual selected executable and actual output writer; synthetic returned compiler results or extracted functions do not replace that connection.
 * @evidence contracts/e2e.md#shared-execution One consumer-local package and dispatcher serve the forwarding contract and41 provenance profiles. Config, logs and response data change only between synchronous requests; native probes and emits remain separate observed processes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Forwarding runs before provenance-profile.json exists. Its mutable config is restored from original provenance fixture bytes before adapter rows; the owner is retained on failure. Completion guards of both bodies do not certify arbitrary descendants or loaded executable images.
 * @evidence contracts/e2e.md#preserved-coverage Both original callbacks retain every current literal/status/count/argv/refusal assertion and per-row failure name. Other stub-family profiles and actual current selection/measurement remain pending; donor removal requires real survivor coverage.
 */
export function test_e2e_compiler_stub(): void {
  const forwarding = FixtureFiles.read("ttsc/compiler/consumer-fake");
  const provenance = FixtureFiles.read("ttsc/compiler/consumer-provenance");
  const root = TestProject.createProject({ ...provenance, ...forwarding });
  TestProject.retainTemporaryDirectory(root, "Shared recorder inputs retained for launcher and probe closure observation");
  const failures: Error[] = [];
  let safeForNext = true;
  try {
    test_compiler_consumer_local_native_compiler_receives_the_launcher_contract(
      root,
      path.join(root, "recorder.cjs"),
      (receipt) => {
        safeForNext = isOrdinarilyClosedReadonlyLauncher(receipt);
        if (!safeForNext)
          throw new Error("Scripted compiler request has unresolved launcher metadata", { cause: receipt.error });
      },
    );
  } catch (cause) {
    failures.push(new Error("consumer compiler launcher contract", { cause }));
  }
  if (!safeForNext)
    throw new AggregateError(failures, "Provenance profiles blocked by unresolved forwarding request");
  fs.writeFileSync(path.join(root, "tsconfig.json"), provenance["tsconfig.json"]!, "utf8");
  const binary = path.join(root, "node_modules", "@typescript", `typescript-${process.platform}-${process.arch}`, "lib", process.platform === "win32" ? "tsc.exe" : "tsc");
  try {
    case_consumer_compiler_preserves_external_emit_provenance(root, binary, process.env);
  } catch (cause) {
    failures.push(new Error("consumer compiler external provenance", { cause }));
  }
  if (failures.length) throw new AggregateError(failures, "Shared scripted compiler profiles failed");
}
