import { Scenarios } from "../internal/Scenarios";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";
import { CompilerApiWorkspace } from "../internal/ttsc/internal/CompilerApiWorkspace";
import { case_evidence_positive_watch_consumers_share_one_watcher } from "./evidence/scenes/case_evidence_positive_watch_consumers_share_one_watcher";
import { test_ttsccompiler_source_plugin_discovery_shares_one_project } from "./ttsc/api/test_ttsccompiler_source_plugin_discovery_shares_one_project";
import { test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins } from "./ttsc/api/test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins";

/**
 * Executes source-plugin API and live-loader watch profiles in one native owner.
 * Its live producer and detached private loader revocation are incompatible
 * with the immutable snapshot dependency owner used by the consumer family.
 *
 * 1. Prepare one outer root, live dependency tree and source-plugin API corpus.
 * 2. Run API discovery/worker states, hold their inputs aside and execute the native warning profile in the same API root.
 * 3. Close the watcher and retain failures under their original phase names.
 *
 * @evidence contracts/testing.md#behavioral-verification Source-plugin API retains thirteen public invocations and discovery/envelope/ambient/timeout/temp literals; the subsequent warning profile retains success, exactly one warning TS9001 and returned api-ok source. Positive watch retains thirteen mutation/diagnostic cycles and its cold comparison. No expected status is replaced.
 * @evidence contracts/testing.md#independent-expectations Authored source/Markdown/Swagger literals and exact findings remain in the existing callbacks; load telemetry is not Program-object identity.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence, real creation/removal, documented/review recovery and destructive loader revocation retain different watcher phases and original controls.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Native lifecycle entry lends one API slot and one prepared live module tree to the existing API and watch batches. Legacy donors keep default preparation; authored selection is not actual invocation or survival proof.
 * @evidence contracts/e2e.md#necessary-boundary Actual filesystem notifications, native resident cycles and Node parser-loader revocation cannot be replaced by supplied callback results.
 * @evidence contracts/e2e.md#shared-execution One outer allocation and fixed checkout/native compiler/cache identities serve API/warning and separate watcher slots. Warning borrows the API root after its complete successful matrix and still writes its private Go module and performs its original native transform. Live dependencies are materialized once; watch borrows them and detaches its destructive library before revocation. Distinct Go sources/Programs remain actual producer events, not inferred reuse. One watcher serves thirteen phases with an additional cold comparison.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original live producer selection and API resets remain. Only successful completion of the API matrix admits moving its entries into api-observed and staging exact warning inputs in its now-empty root; failed API completion preserves inputs and blocks warning replacement. The API slot stays retained and is never overwritten by watcher inputs. Watch uses a separate child workspace, detachment mutates only this owner's library and revocation runs last. Independent watcher failures remain observable without claiming descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage Original source-plugin API and positive-watch literals and failure identities remain. Additional approved Native lifecycle profiles are not claimed as implemented here; baseline/actual selected survival remain remote validation work and donors are retained.
 */
export async function test_e2e_native(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-shared-native-lifecycle-");
  TestProject.retainTemporaryDirectory(root, "Shared native API and watcher inputs retained for closure observation");
  const modules = path.join(root, "node_modules");
  prepareEvidenceDependencies(modules, "workspace");
  const apiRoot = path.join(root, "compiler-api");
  fs.mkdirSync(apiRoot);
  CompilerApiWorkspace.enter({ root: apiRoot }, "baseline");
  const failures: unknown[] = [];
  try {
    await Scenarios.invoke("shared-family", "test_ttsccompiler_source_plugin_discovery_shares_one_project", test_ttsccompiler_source_plugin_discovery_shares_one_project, { root: apiRoot });
    const observed = path.join(root, "api-observed");
    fs.mkdirSync(observed);
    for (const name of fs.readdirSync(apiRoot))
      fs.renameSync(path.join(apiRoot, name), path.join(observed, name));
    await Scenarios.invoke("shared-family", "test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins", test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins, apiRoot);
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
