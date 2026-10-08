import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { BatchWorkspace } from "../../../batch/BatchWorkspace";

/**
 * Verifies real capability workers preserve caller environment authority.
 *
 * The installed public SDK resolves one plugin-free authored project. One
 * isolated actor changes native environment selectors between requests to the
 * same resolver, exercising publication eligibility and retained freshness.
 *
 * 1. Resolve a normal empty answer and invalidate its proof with a caller edit.
 * 2. Contrast uppercase/lowercase preload and runtime selectors with blank and
 *    removed values on the same worker, preserving native platform semantics.
 * 3. Release answers and require the real resolver's terminal close receipt.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed public CapabilityPluginResolver resolves an authored plugins-empty config, checks its retained proof after environment changes and observes each newly resolved answer's currentness through actual worker RPC. The actor asserts resolved status, empty selection and exact true/false controls before closing the owner.
 * @evidence contracts/testing.md#independent-expectations Windows native environment identity requires lowercase preload/runtime aliases to reject reuse; POSIX treats them as unrelated names. Uppercase selectors always reject, blank options permit normal authority, and removal restores unchanged normal proof under the complete environment-key contract.
 * @evidence contracts/testing.md#distinguishing-cases Initial normal proof, changed-proof rejection, removed-proof recovery, lowercase/uppercase startup options, blank options, lowercase/uppercase relative runtimes and final normal recovery distinguish both cache eligibility and later freshness. Duplicate/undefined supplied snapshots are owned by the direct SidecarEnvironment unit.
 * @evidence contracts/testing.md#execution-ownership The graph batch invokes this scene once. One real Node actor loads the installed public SDK and owns one actual capability worker across all rows; the plugins-empty authored project requires native project observation but no plugin build. The optional SDK module seam is used only by a narrow matching-root-SDK experiment, not the installed CI claim.
 * @evidence contracts/e2e.md#necessary-boundary Real caller cloning, worker adoption, public resolution and opaque freshness RPC must agree. The pure replacement unit and isolated predicate probe cannot prove this connection or publication behavior.
 * @evidence contracts/e2e.md#shared-execution The existing BatchWorkspace installation supplies SDK and native binaries. Static fixture files are copied with the normal shared fixture; one process/resolver/project serves every environment transition without another installation, native source build or cache deletion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Environment mutations occur only inside the isolated actor. Every answer is released, and resolver.close joins its worker/native owners before the actor emits the close receipt. Missing closure retains shared inputs rather than permitting later consumers to reuse them.
 * @evidence contracts/e2e.md#preserved-coverage Adds the previously absent real worker alias/public-freshness regression; no existing graph assertions or cold cancellation/EOF lifetimes are replaced. Portable duplicate selection, undefined and snapshot replacement distinctions stay in their direct unit.
 */
export function case_capability_worker_environment_preserves_runtime_authority(
  workspace: Pick<BatchWorkspace.Workspace, "root" | "cache">,
  sdkModule?: string,
): void {
  const root = path.join(workspace.root, "tools/capability-environment");
  const sdk = sdkModule ?? createRequire(path.join(workspace.root, "package.json")).resolve("ttsc");
  const env: NodeJS.ProcessEnv = { TTSC_CACHE_DIR: workspace.cache, NODE_OPTIONS: undefined, TTSC_NODE_BINARY: undefined };
  for (const key of Object.keys(process.env))
    if (["NODE_OPTIONS", "TTSC_NODE_BINARY"].includes(key.toUpperCase()))
      env[key] = undefined;
  const result = TestProject.spawn(process.execPath, [path.join(root, "runner.cjs"), sdk], { cwd: root, env });
  if (!result.stdout.includes("CAPABILITY_ENVIRONMENT_RESOLVER_CLOSED"))
    BatchWorkspace.retain("capability environment actor did not certify resolver closure");
  assert.equal(result.error, undefined, result.stderr);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("CAPABILITY_ENVIRONMENT_RESOLVER_CLOSED"), result.stdout);
}
