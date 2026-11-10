import assert from "node:assert/strict";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { notifyFailedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyFailedGenerationInputs";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies batched module deliveries carry their recorded environment reads.
 *
 * Metro must retain these inputs even when a delivery reuses a generation.
 *
 * 1. Notify a batching host twice from one environment-reading generation.
 * 2. Remove the record and notify the host again.
 * 3. Notify a failed generation and require its record and recovery flag too.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls successful and failed notification owners and observes environment records and the recovery flag on the actual batching callback.
 * @evidence contracts/testing.md#independent-expectations The expected values and null absence are authored generation data; the host must receive those exact inputs.
 * @evidence contracts/testing.md#distinguishing-cases Repeated delivery contrasts absent reads and failed recovery; records include an empty value and an unset variable.
 * @evidence contracts/testing.md#execution-ownership The unit runner calls authored notification code over a temporary project without a compiler, installation or bundler host.
 */
export function test_environment_inputs_reach_batched_delivery_hooks(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const recorded = { MODE: "production", EMPTY: "", UNSET: null };
  const deliveries: unknown[] = [];
  const recovery: (boolean | undefined)[] = [];
  const hooks = {
    addWatchFiles: (
      _inputs: unknown,
      failed?: boolean,
      environmentInputs?: Readonly<Record<string, string | null>>,
    ) => {
      deliveries.push(environmentInputs);
      recovery.push(failed);
    },
  };
  const selection = {
    consulted: [],
    filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
    tsconfig: fixture.good.tsconfig!,
  };
  try {
    fixture.good.result.environmentInputs = recorded;
    notifyWatchInputs(hooks, fixture.good, fixture.file, selection);
    notifyWatchInputs(hooks, fixture.good, fixture.file, selection);
    delete fixture.good.result.environmentInputs;
    notifyWatchInputs(hooks, fixture.good, fixture.file, selection);
    notifyFailedGenerationInputs(
      hooks,
      {
        ...fixture.good,
        result: {
          type: "failure",
          diagnostics: [],
          environmentInputs: recorded,
          typescript: {},
        },
      },
      fixture.file,
      selection,
    );
    assert.deepEqual(deliveries, [recorded, recorded, undefined, recorded]);
    assert.deepEqual(recovery, [undefined, undefined, undefined, true]);
  } finally {
    fixture.dispose();
  }
}
