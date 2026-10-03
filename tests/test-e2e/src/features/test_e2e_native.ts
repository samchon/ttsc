import { Scenarios } from "../internal/Scenarios";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { prepareEvidenceDependencies } from "../../../utils/src/evidence/prepareEvidenceDependencies";
import { CompilerApiWorkspace } from "../internal/ttsc/internal/CompilerApiWorkspace";
import { case_evidence_positive_watch_consumers_share_one_watcher } from "./evidence/scenes/case_evidence_positive_watch_consumers_share_one_watcher";
import { test_ttsccompiler_source_plugin_discovery_shares_one_project } from "./ttsc/api/test_ttsccompiler_source_plugin_discovery_shares_one_project";
import { test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins } from "./ttsc/api/test_ttsccompiler_transform_preserves_warning_diagnostics_from_check_plugins";
import { test_ttsccompiler_transform_omits_host_hash_changed_by_native_execution } from "./ttsc/api/test_ttsccompiler_transform_omits_host_hash_changed_by_native_execution";

/**
 * Executes source-plugin API and live-loader watch profiles in one native owner.
 * Its live producer and detached private loader revocation are incompatible
 * with the immutable snapshot dependency owner used by the consumer family.
 *
 * 1. Prepare one outer root, live dependency tree and source-plugin API corpus.
 * 2. Run API discovery/worker states, then native warning and host-proof profiles in the same API root with prior inputs held aside.
 * 3. Close the watcher and retain failures under their original phase names.
 *
 * @evidence contracts/testing.md#behavioral-verification Source-plugin API retains thirteen public invocations and discovery/envelope/ambient/timeout/temp literals. Warning retains success/one-warning/TS9001/api-ok; host-proof retains success versus check failure, observed config path, absent stale hash and exact new disk bytes in both stages. Positive watch retains thirteen mutation/diagnostic cycles and its cold comparison. No expected status is replaced.
 * @evidence contracts/testing.md#independent-expectations Authored source/Markdown/Swagger literals and exact findings remain in the existing callbacks; load telemetry is not Program-object identity.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence, real creation/removal, documented/review recovery and destructive loader revocation retain different watcher phases and original controls.
 * @evidence contracts/testing.md#execution-ownership The explicit consolidated Native lifecycle entry lends one API slot and one prepared live module tree to the existing API and watch batches. Legacy donors keep default preparation; authored selection is not actual invocation or survival proof.
 * @evidence contracts/e2e.md#necessary-boundary Actual filesystem notifications, native resident cycles and Node parser-loader revocation cannot be replaced by supplied callback results.
 * @evidence contracts/e2e.md#shared-execution One outer allocation and fixed checkout/native compiler/cache identities serve API/warning/host-proof and separate watcher slots. API completion gates exact warning staging; warning completion gates two host-proof stages in the same physical root. Each still writes its original private Go module and performs its original native requests. Live dependencies are materialized once for watch. Distinct Go sources/Programs remain actual events, not inferred reuse; watcher phases retain an additional cold comparison.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original live producer selection and API resets remain. Only successful completion of the API matrix admits moving its entries into api-observed and staging exact warning inputs in its now-empty root; failed API completion preserves inputs and blocks warning replacement. The API slot stays retained and is never overwritten by watcher inputs. Watch uses a separate child workspace, detachment mutates only this owner's library and revocation runs last. Independent watcher failures remain observable without claiming descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage Original API, warning, host-proof and positive-watch literals and named failures remain. Prior warning failure blocks mutable host-proof staging and is reported; host-proof collects both assertions after returned results but blocks replacement after a thrown transport. Additional approved Native profiles remain incomplete, baseline/survival are remote validation work and donors are retained.
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
    const warningObserved = path.join(root, "warning-observed");
    fs.mkdirSync(warningObserved);
    for (const name of fs.readdirSync(apiRoot))
      fs.renameSync(path.join(apiRoot, name), path.join(warningObserved, name));
    await Scenarios.invoke("shared-family", "test_ttsccompiler_transform_omits_host_hash_changed_by_native_execution", test_ttsccompiler_transform_omits_host_hash_changed_by_native_execution, { root: apiRoot, observedRoot: path.join(root, "host-proof-observed") });
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
