import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, listWorkerSnapshots } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

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
 * @evidence contracts/testing.md#distinguishing-cases Positive volatility delivery complements recorder-only volatile-to-clean recovery and key nonreuse source cases.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary The native producer must transmit plugin-declared volatility through the transform callback into persisted Metro state.
 * @evidence contracts/e2e.md#shared-execution One native project/plugin observation uses the suite shared producer and creates one snapshot; no per-assertion build, installation or extra host starts. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity  Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Original one-worker and volatile:true assertions remain at the actual compiler connection.
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
