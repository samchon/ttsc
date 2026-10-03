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
import { test_ttsccompiler_prepare_builds_source_plugins_and_clean_removes_context_cache } from "./ttsc/api/test_ttsccompiler_prepare_builds_source_plugins_and_clean_removes_context_cache";
import { test_ttsccompiler_clean_removes_relative_context_env_cache } from "./ttsc/api/test_ttsccompiler_clean_removes_relative_context_env_cache";

/**
 * Executes source-plugin API and live-loader watch profiles in one native owner.
 * Its live producer and detached private loader revocation are incompatible
 * with the immutable snapshot dependency owner used by the consumer family.
 *
 * 1. Prepare one outer root, live dependency tree and source-plugin API corpus.
 * 2. Run API discovery/worker, warning, host-proof and provenance profiles, then explicit/relative private cache lifecycles in the same API root.
 * 3. Execute the original six lightweight resident pipe-protocol owners with the same selected Node and built client modules.
 * 4. Close the watcher and retain failures under their original phase names.
 *
 * @evidence contracts/testing.md#behavioral-verification API retains discovery/environment, warning TS9001, host-proof invalidation and provenance source/flag/no-plugin assertions. Explicit and relative cache owners retain prepared count/location/presence, exact removed roots and absence, including the authored Go-cache seed. Six resident owners retain original negative/framing/shape/queue/bound/lifecycle assertions and cleanup. Watch retains thirteen cycles/cold comparison. No expected status is replaced.
 * @evidence contracts/testing.md#independent-expectations Authored source/Markdown/Swagger literals and exact findings remain in the existing callbacks; load telemetry is not Program-object identity.
 * @evidence contracts/testing.md#distinguishing-cases Initial absence, real creation/removal, documented/review recovery and destructive loader revocation retain different watcher phases and original controls.
 * @evidence contracts/testing.md#execution-ownership The explicit Native lifecycle entry lends one API slot and prepared live module tree to native API/watch owners and invokes six unchanged resident protocol exports. Every named failure remains collected. Legacy donors keep default preparation; registration is not actual invocation or survival proof.
 * @evidence contracts/e2e.md#necessary-boundary Filesystem notifications, native cycles and Node parser-loader revocation require their real connections. Resident programmed Node peers exercise actual pipe framing, request settlement and retirement of the built client; they are protocol inputs, not Go semantic or compatibility oracles.
 * @evidence contracts/e2e.md#shared-execution One allocation and fixed tools serve staged API/warning/host-proof/provenance/cache owners and a separate watch slot. Private modules, original requests and changed keys remain. Two private-cache lifecycles share verified unchanged source inputs but retain both prepare/clean calls and cold namespaces, distinct from suite shared cache. Six peers share Node/built client, require no build/install/project and keep necessary terminal lifetimes. Live dependencies are materialized once for watch; no child/Program/cache-hit reduction is inferred.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original live producer selection and API resets remain. Only successful completion of the API matrix admits moving its entries into api-observed and staging exact warning inputs in its now-empty root; failed API completion preserves inputs and blocks warning replacement. The API slot stays retained and is never overwritten by watcher inputs. Watch uses a separate child workspace, detachment mutates only this owner's library and revocation runs last. Independent watcher failures remain observable without claiming descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage Original API/warning/host-proof/provenance/private-cache, six peer and positive-watch assertions remain. Prior failures block mutable API staging, and cache source-byte or empty-namespace conflicts block the relative profile rather than hiding failure. Independent peers/watch remain attempted with original cleanup. Additional Native profiles remain incomplete; baseline/survival are remote work and donors remain.
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
    const plainObserved = path.join(root, "plugin-free-observed");
    fs.mkdirSync(plainObserved);
    for (const name of fs.readdirSync(apiRoot))
      fs.renameSync(path.join(apiRoot, name), path.join(plainObserved, name));
    await Scenarios.invoke("shared-family", "test_ttsccompiler_prepare_builds_source_plugins_and_clean_removes_context_cache", test_ttsccompiler_prepare_builds_source_plugins_and_clean_removes_context_cache, apiRoot);
    await Scenarios.invoke("shared-family", "test_ttsccompiler_clean_removes_relative_context_env_cache", test_ttsccompiler_clean_removes_relative_context_env_cache, apiRoot);
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
