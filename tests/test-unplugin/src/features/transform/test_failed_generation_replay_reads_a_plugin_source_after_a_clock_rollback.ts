import assert from "node:assert/strict";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import type { TtscFailedGenerationValidation } from "../../../../../packages/unplugin/src/core/transform/generation/TtscFailedGenerationValidation";
import { failedGenerationEnvironmentChanged } from "../../../../../packages/unplugin/src/core/transform/generation/failedGenerationEnvironmentChanged";
import { projectWalkFailureFingerprint } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkFailureFingerprint";
import { pluginSourceState } from "../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { walkSnapshotComplete } from "../../../../../packages/unplugin/src/core/transform/validation/walkSnapshotComplete";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../packages/unplugin/src/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { createClockRollbackUnitFixture } from "../../internal/transform-project-cache/createClockRollbackUnitFixture";

/**
 * Verifies failedGenerationEnvironmentChanged stops reusing held plugin-source metadata
 * when the current filesystem clock reference falls behind those stamps.
 *
 * The bytes change while the supported filesystem view holds source metadata.
 * A newly minted probe under the authored rollback must withdraw the old
 * separability premise. Real Go environment inputs are preserved, not mocked.
 *
 * 1. Record real source state and require the unchanged proof's first verdict.
 * 2. Hold real source stamps and edit bytes; require the recorded digest to hold.
 * 3. Apply the outside probe's two-hour timestamp step and require rereading.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual failedGenerationEnvironmentChanged through its existing recorded-input boundary and requires false/false/true, with each confirmation in a separate event-loop turn. The rollback row detects reuse of a digest whose metadata is no longer separable from the current clock.
 * @evidence contracts/testing.md#independent-expectations Actual appended bytes, held pre-edit BigIntStats and literal -7200000000000n probe offset independently establish the changed validity premise. Literal three-state verdicts follow that premise; the recorded pluginSourceState is setup rather than an independent digest-encoding oracle.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged source contrasts with edited bytes under retained metadata, then the same edit under a current rolled-back probe. The other two direct entries own the other proof consumers. Authored record/generation/tracker fields are supported comparator inputs, not claims that native capture produced them.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit owns its three verdicts using a suite-owned helper and the original package-owned fixture bytes. Real source and Go env/version/GOROOT observations remain owning input capabilities; no compiler/plugin build, native notification backend, installed consumer or host runs. Controlled rollback does not assert an actual host-clock rollback or transported native coverage.
 */
export async function test_failed_generation_replay_reads_a_plugin_source_after_a_clock_rollback(): Promise<void> {
  const fixture = createClockRollbackUnitFixture();
  const result = { type: "success", typescript: {} };
  TRANSFORM_RESULT_FILESYSTEM.set(result as never, fixture.filesystem);
  const cached = {
    membershipPolicy: PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
    projectRoot: fixture.project,
    result,
  } as unknown as TtscCachedProjectTransform;
  const identities = envelopeDerivation(cached).identityContext;
  const snapshot = collectProjectInputSnapshot(
    fixture.project,
    identities,
    fixture.filesystem,
    undefined,
    { policy: PERMISSIVE_PROJECT_MEMBERSHIP_POLICY },
  );
  cached.projectDirectories = snapshot.projectDirectories;
  fixture.settle();
  fixture.mintEarlier();
  const recordedState = pluginSourceState(fixture.source);
  assert.ok(recordedState, "actual source and native environment must be readable");
  const validation: TtscFailedGenerationValidation = {
    cached,
    declaredInputs: undefined,
    inputStates: new Map([
      [
        fixture.source,
        { state: recordedState, tree: true },
      ],
    ]),
    projectInputHashes: snapshot.hashes,
    projectWalkComplete: walkSnapshotComplete(snapshot, undefined),
    projectWalkFailures: projectWalkFailureFingerprint(
      snapshot,
      undefined,
      fixture.project,
      identities,
    ),
  };
  const module = path.join(fixture.project, "src", "index.ts");
  /** Confirm in a turn of its own, as a later delivery does. */
  const changed = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return failedGenerationEnvironmentChanged(validation, {
      currentFile: module,
      currentSource: "export const value = 1;\n",
      filesystem: fixture.filesystem,
    });
  };

  // 1. Nothing moved.
  assert.equal(await changed(), false);

  // 2. Held metadata stands for the bytes.
  fixture.hold();
  fixture.edit();
  assert.equal(
    await changed(),
    false,
    "the metadata holds, so the digest does",
  );

  // 3. After a rollback, the files are read.
  fixture.stepBack();
  assert.equal(
    await changed(),
    true,
    "a reference minted since the rollback puts the stamps inside it",
  );
}
