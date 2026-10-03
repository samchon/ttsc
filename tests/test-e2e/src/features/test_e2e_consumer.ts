import { TestProject } from "@ttsc/testing";
import path from "node:path";

import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";
import { UtilityWorkspace } from "../internal/UtilityWorkspace";
import { test_e2e_evidence } from "./test_e2e_evidence";
import { test_e2e_utilities } from "./test_e2e_utilities";

/**
 * Runs compatible utility and Evidence consumers beneath one dependency owner.
 * Three utility package links and one published Evidence dependency tree serve
 * all immutable profiles. Authored project/config boundaries stay disjoint,
 * and every real command and Program remains a separate observed operation.
 * The destructive live-producer watcher retains its Native lifecycle family.
 *
 * 1. Copy the utility corpus and prepare the shared snapshot dependencies once.
 * 2. Run utility outputs and Evidence transition/combined-corpus assertions.
 * 3. Collect both named failures; release only after successful borrower cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual utility output/runtime and Evidence check/resident scenarios retain their owning literal oracles; this entry aggregates their independent failure identities without substituting results.
 * @evidence contracts/testing.md#independent-expectations Original source markers, config severities, full emitted bytes and graph diagnostics remain independently authored in the existing scenes.
 * @evidence contracts/testing.md#distinguishing-cases Utility discovery ancestors remain manifest-free and separate from the Evidence child projects; snapshot-compatible checks share dependencies while destructive live-loader watch inputs use the Native lifecycle owner.
 * @evidence contracts/testing.md#execution-ownership The consolidated consumer family explicitly invokes the two existing genuine scene batches with borrowed preparation, rather than their original allocating setup paths.
 * @evidence contracts/e2e.md#necessary-boundary Actual plugin/config loading, native transforms, emitted Node execution and Evidence Node/Go bridges still cross their real producer/consumer connections.
 * @evidence contracts/e2e.md#shared-execution One copied manifest-free corpus and one shared dependency materialization replace separate utility and immutable Evidence package trees. Different source/compiler profiles still create independent requests and Programs; measured reduction is not asserted here.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each Evidence child owns its ancestor files and cleanup while borrowing immutable modules. Utility scenes borrow the common corpus without removing it. Any failure retains the whole owner, so unresolved readers are not erased by common cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Existing utility and immutable Evidence callbacks keep all current assertions and names. Positive watcher callbacks are explicitly selected by the Native lifecycle family, not claimed here; unmapped donors and actual survivor execution remain required before removal.
 */
export async function test_e2e_consumer(): Promise<void> {
  const workspace = UtilityWorkspace.open();
  TestProject.retainTemporaryDirectory(workspace.root);
  const failures: Error[] = [];
  try {
    const modules = path.join(workspace.root, "node_modules");
    prepareEvidenceDependencies(modules, "snapshot");
    try {
      await test_e2e_utilities(workspace);
    } catch (cause) {
      failures.push(new Error("consumer utility profiles", { cause }));
    }
    try {
      await test_e2e_evidence({ preparedModules: modules, workspaceParent: workspace.root, includeWatch: false });
    } catch (cause) {
      failures.push(new Error("consumer Evidence profiles", { cause }));
    }
  } catch (cause) {
    failures.push(new Error("common consumer preparation", { cause }));
  }
  if (failures.length === 0) {
    try { UtilityWorkspace.close(workspace); }
    catch (cause) { failures.push(new Error("common consumer cleanup", { cause })); }
  }
  if (failures.length) throw new AggregateError(failures, "Shared consumer profiles failed");
}
