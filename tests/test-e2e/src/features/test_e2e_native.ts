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
import { test_ttsccompiler_transform_reports_the_plugin_sources_its_binaries_were_built_from } from "./ttsc/api/test_ttsccompiler_transform_reports_the_plugin_sources_its_binaries_were_built_from";
import { test_residenttransformprocess_resolves_valid_negative_replies } from "./ttsc/api/test_residenttransformprocess_resolves_valid_negative_replies";
import { test_residenttransformprocess_rejects_framing_violations } from "./ttsc/api/test_residenttransformprocess_rejects_framing_violations";
import { test_residenttransformprocess_rejects_wrong_operation_shape } from "./ttsc/api/test_residenttransformprocess_rejects_wrong_operation_shape";
import { test_residenttransformprocess_malformed_reply_fails_queued_requests } from "./ttsc/api/test_residenttransformprocess_malformed_reply_fails_queued_requests";
import { test_residenttransformprocess_request_bounds } from "./ttsc/api/test_residenttransformprocess_request_bounds";
import { test_residenttransformprocess_lifecycle } from "./ttsc/api/test_residenttransformprocess_lifecycle";

/**
 * Executes source-plugin API and live-loader watch profiles in one native owner.
 * Its live producer and detached private loader revocation are incompatible
 * with the immutable snapshot dependency owner used by the consumer family.
 *
 * 1. Prepare one outer root, live dependency tree and source-plugin API corpus.
 * 2. Run API discovery/worker, warning, host-proof and plugin-provenance profiles in the same API root with prior inputs held aside.
 * 3. Execute the original six lightweight resident pipe-protocol owners with the same selected Node and built client modules.
 * 4. Close the watcher and retain failures under their original phase names.
 *
 * @evidence contracts/testing.md#behavioral-verification API retains thirteen discovery/envelope/environment calls, warning TS9001/source, host-proof success/check-failure/path/hash/new bytes and provenance ignored/source/flag/no-plugin contrasts. Six resident owners retain legal-negative, raw framing, wrong operation, queued corruption, request-bound and lifecycle assertions with their original cleanup. Watch retains thirteen cycles and its cold comparison. No expected status is replaced.
 * @evidence contracts/testing.md#independent-expectations Authored source/Markdown/Swagger literals and exact findings remain in the existing callbacks; load telemetry is not Program-object identity.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence, real creation/removal, documented/review recovery and destructive loader revocation retain different watcher phases and original controls.
 * @evidence contracts/testing.md#execution-ownership The explicit Native lifecycle entry lends one API slot and prepared live module tree to native API/watch owners and invokes six unchanged resident protocol exports. Every named failure remains collected. Legacy donors keep default preparation; registration is not actual invocation or survival proof.
 * @evidence contracts/e2e.md#necessary-boundary Filesystem notifications, native cycles and Node parser-loader revocation require their real connections. Resident programmed Node peers exercise actual pipe framing, request settlement and retirement of the built client; they are protocol inputs, not Go semantic or compatibility oracles.
 * @evidence contracts/e2e.md#shared-execution One allocation and fixed compiler/cache identities serve staged API/warning/host-proof/provenance and a separate watcher slot. Original private modules/requests and changed source/flag keys remain. Six pipe-protocol owners share selected Node and built client modules; their lightweight immutable -e scripts require no Go build/install/project and terminating or incompatible replies still require separate actual peer lifetimes. No child/Program reduction is inferred. Live dependencies are materialized once for watch, with its original cold comparison.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original live producer selection and API resets remain. Only successful completion of the API matrix admits moving its entries into api-observed and staging exact warning inputs in its now-empty root; failed API completion preserves inputs and blocks warning replacement. The API slot stays retained and is never overwritten by watcher inputs. Watch uses a separate child workspace, detachment mutates only this owner's library and revocation runs last. Independent watcher failures remain observable without claiming descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage Original API, warning, host-proof, provenance, six resident peer and positive-watch owner assertions remain. Prior failures block mutable API staging; peer and watcher inputs are independent and still attempted. Each resident owner disposes and awaits its actual subscribed child close, preserving timeout as cleanup failure; this is not arbitrary descendant certification. Additional Native profiles remain incomplete, baseline/survival are remote validation work and donors are retained.
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
    const hostCheckObserved = path.join(root, "host-proof-observed", "check");
    fs.mkdirSync(hostCheckObserved);
    for (const name of fs.readdirSync(apiRoot))
      fs.renameSync(path.join(apiRoot, name), path.join(hostCheckObserved, name));
    await Scenarios.invoke("shared-family", "test_ttsccompiler_transform_reports_the_plugin_sources_its_binaries_were_built_from", test_ttsccompiler_transform_reports_the_plugin_sources_its_binaries_were_built_from, { root: apiRoot, observedRoot: path.join(root, "plugin-provenance-observed") });
  } catch (cause) {
    failures.push(new Error("native source-plugin API profiles", { cause }));
  }
  const peerProfiles = [
    ["test_residenttransformprocess_resolves_valid_negative_replies", test_residenttransformprocess_resolves_valid_negative_replies],
    ["test_residenttransformprocess_rejects_framing_violations", test_residenttransformprocess_rejects_framing_violations],
    ["test_residenttransformprocess_rejects_wrong_operation_shape", test_residenttransformprocess_rejects_wrong_operation_shape],
    ["test_residenttransformprocess_malformed_reply_fails_queued_requests", test_residenttransformprocess_malformed_reply_fails_queued_requests],
    ["test_residenttransformprocess_request_bounds", test_residenttransformprocess_request_bounds],
    ["test_residenttransformprocess_lifecycle", test_residenttransformprocess_lifecycle],
  ] as const;
  for (const [name, run] of peerProfiles) {
    try {
      await Scenarios.invoke("shared-native-peer", name, run);
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  }
  try {
    await Scenarios.invoke("shared-family", "case_evidence_positive_watch_consumers_share_one_watcher", case_evidence_positive_watch_consumers_share_one_watcher, { workspaceParent: root, preparedModules: modules });
  } catch (cause) {
    failures.push(new Error("native live-producer watcher profiles", { cause }));
  }
  if (failures.length) throw new AggregateError(failures, "shared native lifecycle profiles");
}
