import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import {
  listWorkerSnapshots,
  prepareSnapshot,
} from "../../../internal/metro/internal/metro-snapshot";

/**
 * Verifies a plugin-declared volatile transform marks the worker snapshot
 * volatile.
 *
 * The marker is what feeds the nonce degradation on the next run's key; a
 * dropped declaration would let Metro replay outputs that depend on non-file
 * inputs. Exercises the real native compiler, so it runs where the Go toolchain
 * is present (CI).
 *
 * 1. Transform a file through a plugin that declares it volatile.
 * 2. Read this worker's snapshot file.
 * 3. Assert `volatile: true`.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native plugin metadata creates one worker snapshot with volatile:true for its transformed entry.
 * @evidence contracts/testing.md#independent-expectations The authored plugin declaration independently marks src/main.ts volatile; exact worker count and boolean establish delivery.
 * @evidence contracts/testing.md#distinguishing-cases This positive only checks one worker and volatile:true, not clock-dependent output or key nonreuse. Named direct cache entries test_clean_transform_clears_a_volatile_snapshot and test_cache_key_folds_a_nonce_while_the_snapshot_records_volatile separately drive recorder clearing and authored volatile-key policy; they do not execute native declaration delivery.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes the selected native volatile reporter through default built transformer modules unless TTSC_TEST_LAYER=unit. An authored echo upstream is not a real Metro server/OS worker; source override does not prove built assembly, and current direct-unit bodies are not runtime survival certificates.
 * @evidence contracts/e2e.md#necessary-boundary The native producer must transmit plugin-declared volatility through the transform callback into persisted Metro state.
 * @evidence contracts/e2e.md#shared-execution One owned project/volatile descriptor and awaited transform share selected producer artifacts; one snapshot file is asserted, not native process/Program/cache counts. No producer is deliberately prepared per assertion; fresh module imports are not OS workers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Slot replacement drops prior worker/epoch input, runtime options env restores after the awaited transform and parent aggregate cleanup owns files after case settlement. One persisted marker is not proof of arbitrary descendant join, loaded-image identity or future cache nonreuse.
 * @evidence contracts/e2e.md#preserved-coverage Original exactly-one-worker and volatile:true assertions remain at native delivery. Exact direct owners live in tests/test-metro/src/features/cache with the two stated names; their authored helper operations are complementary, not this producer proof. Registration/built-layer binding/runtime survival/measurement remain unverified.
 */
export async function case_metro_transformer_records_volatile_declarations_in_the_worker_snapshot(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterProject(workspace, { plugins: [] });
  await prepareSnapshot(root);
  await TestMetroRuntime.runTransform({
    options: {
      upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "volatile",
          operation: "emit-volatile",
          volatile: ["src/main.ts"],
        },
      ],
    },
    params: {
      src: TestUnpluginProject.mainSource(root),
      filename: "src/main.ts",
      options: { projectRoot: root },
    },
  });
  const workers = listWorkerSnapshots(root);
  assert.equal(workers.length, 1);
  const parsed = JSON.parse(fs.readFileSync(workers[0]!, "utf8"));
  assert.equal(parsed.volatile, true);
}
