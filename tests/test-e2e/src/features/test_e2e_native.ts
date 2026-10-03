import { Scenarios } from "../internal/Scenarios";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";
import { CompilerApiWorkspace } from "../internal/ttsc/internal/CompilerApiWorkspace";
import { case_evidence_positive_watch_consumers_share_one_watcher } from "./evidence/scenes/case_evidence_positive_watch_consumers_share_one_watcher";
import { test_ttsccompiler_source_plugin_discovery_shares_one_project } from "./ttsc/api/test_ttsccompiler_source_plugin_discovery_shares_one_project";

/**
 * Executes source-plugin API and live-loader watch profiles in one native owner.
 * Its live producer and detached private loader revocation are incompatible
 * with the immutable snapshot dependency owner used by the consumer family.
 *
 * 1. Prepare one outer root, live dependency tree and source-plugin API corpus.
 * 2. Run API discovery/worker states and the named watcher mutation phases.
 * 3. Close the watcher and retain failures under their original phase names.
 *
 * @evidence contracts/testing.md#behavioral-verification Source-plugin API retains its thirteen public invocations, discovery/envelope/ambient/timeout/temp diagnostics and original literals; the positive-watch owner retains thirteen mutation/diagnostic cycles and its cold comparison. No alternate expected status replaces either owner.
 * @evidence contracts/testing.md#independent-expectations Authored source/Markdown/Swagger literals and exact findings remain in the existing callbacks; load telemetry is not Program-object identity.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence, real creation/removal, documented/review recovery and destructive loader revocation retain different watcher phases and original controls.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Native lifecycle entry lends one API slot and one prepared live module tree to the existing API and watch batches. Legacy donors keep default preparation; authored selection is not actual invocation or survival proof.
 * @evidence contracts/e2e.md#necessary-boundary Actual filesystem notifications, native resident cycles and Node parser-loader revocation cannot be replaced by supplied callback results.
 * @evidence contracts/e2e.md#shared-execution One outer allocation and fixed checkout/native compiler/cache identities serve separate API and watcher input slots. Live dependencies are materialized once; the watcher borrows them and detaches its destructive library before revocation. Distinct Go plugin sources and Programs remain separate actual producer events. One watcher serves thirteen phases; its independent cold comparison remains an additional request.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original live producer selection is preserved. API state/environment resets remain in their owner; its borrowed slot stays retained even on failure and is never overwritten by watcher inputs. Watcher project/sibling inputs use a separate child workspace, detachment mutates only this owner's prepared library, and revocation runs last. Both named failures are collected without removing common inputs or pretending unknown workers/descendants were joined.
 * @evidence contracts/e2e.md#preserved-coverage Original source-plugin API and positive-watch literals and failure identities remain. Additional approved Native lifecycle profiles are not claimed as implemented here; baseline/actual selected survival remain remote validation work and donors are retained.
 */
export async function test_e2e_native(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-shared-native-lifecycle-");
  TestProject.retainTemporaryDirectory(root);
  const modules = path.join(root, "node_modules");
  prepareEvidenceDependencies(modules, "workspace");
  const apiRoot = path.join(root, "compiler-api");
  fs.mkdirSync(apiRoot);
  CompilerApiWorkspace.enter({ root: apiRoot }, "baseline");
  const failures: unknown[] = [];
  try {
    await Scenarios.invoke("shared-family", "test_ttsccompiler_source_plugin_discovery_shares_one_project", test_ttsccompiler_source_plugin_discovery_shares_one_project, { root: apiRoot });
  } catch (cause) {
    failures.push(new Error("native source-plugin API profiles", { cause }));
  }
  try {
    await Scenarios.invoke("shared-family", "case_evidence_positive_watch_consumers_share_one_watcher", case_evidence_positive_watch_consumers_share_one_watcher, { workspaceParent: root, preparedModules: modules });
  } catch (cause) {
    failures.push(new Error("native live-producer watcher profiles", { cause }));
  }
  if (failures.length) throw new AggregateError(failures, "shared native lifecycle profiles");
}
