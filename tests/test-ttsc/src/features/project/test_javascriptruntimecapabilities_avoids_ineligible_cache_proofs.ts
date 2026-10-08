import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Verifies fresh capability probes avoid proofs for an ineligible cache.
 *
 * A separate source actor owns its first trace root and capability cache. This
 * keeps the unit runner's existing process-global trace admission untouched.
 *
 * 1. Observe real Node children and proof events for eligible and preload calls.
 * 2. Exercise native aliases, relative commands and failed/malformed recovery.
 * 3. Retarget an actual native directory link between small fingerprint inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification The isolated actor imports the actual authored capability and fingerprint owners through the existing unit loader. It asserts successful fresh children with zero cache-only identity events, eligible miss/hit proof counts, unsupported failures and subsequent recovery, and changed physical identity after native link redirection.
 * @evidence contracts/testing.md#independent-expectations Real Node must report its own executable, false Bun and available registerHooks. Literal process outcomes and per-operation trace events independently distinguish child execution from cache reuse and zero content proofs from unobserved work. Authored abc/abd inputs and native realpath/stat observations establish the link targets independently of fingerprint results.
 * @evidence contracts/testing.md#distinguishing-cases Nonblank, empty and whitespace NODE_OPTIONS, Windows case aliases versus POSIX distinct names, bare/relative commands, failed spawn, nonzero and malformed output, and recovery retain separate actor row identities. Existing fingerprint, relative-selection/replacement and mutable-wrapper units retain their complementary controls; this case adds the missing native directory-link retarget observation without copying a runtime.
 * @evidence contracts/testing.md#execution-ownership This named source unit starts one isolated Node test actor and sequential actual capability children without an installation, compiler, Go build or product host. The actor's synchronous primitives return before private-root cleanup; a spawn error or signal leaves scratch retained because actor completion is unconfirmed. Unsupported native link creation is a failure, never credited as a retarget PASS. Script-body assertions are reviewed through this entry rather than separately discoverable Evidence hosts.
 */
export function test_javascriptruntimecapabilities_avoids_ineligible_cache_proofs(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-capability-proofs-"));
  const trace = path.join(root, "trace");
  fs.mkdirSync(trace);
  const actor = fileURLToPath(
    new URL("../../internal/runtime-capability-cache-actor.ts", import.meta.url),
  );
  const loader = new URL(
    "../../../../../config/register-unit-loader.mjs",
    import.meta.url,
  ).href;
  const result = childProcess.spawnSync(
    process.execPath,
    ["--import", loader, actor, root],
    {
      encoding: "utf8",
      env: SidecarEnvironment.merge(process.env, {
        NODE_OPTIONS: undefined,
        TTSC_E2E_TRACE: trace,
      }),
      windowsHide: true,
    },
  );
  const failures: unknown[] = [];
  try {
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout) as {
      failures: unknown[];
      observations: { name: string }[];
    };
    assert.deepEqual(report.failures, []);
    assert.ok(report.observations.length > 0);
  } catch (error) {
    failures.push(error);
  } finally {
    if (
      result.error === undefined &&
      result.signal === null &&
      result.status !== null
    ) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (error) {
        failures.push(error);
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      `capability proof actor failed; scratch ${root}`,
    );
}
