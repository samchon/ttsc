import assert from "node:assert/strict";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import { envelopeDerivation } from "../../../../../packages/unplugin/lib/core/transform/envelope/envelopeDerivation.mjs";
import type { TtscFailedGenerationValidation } from "../../../../../packages/unplugin/lib/core/transform/generation/TtscFailedGenerationValidation.mjs";
import { failedGenerationEnvironmentChanged } from "../../../../../packages/unplugin/lib/core/transform/generation/failedGenerationEnvironmentChanged.mjs";
import { projectWalkFailureFingerprint } from "../../../../../packages/unplugin/lib/core/transform/generation/projectWalkFailureFingerprint.mjs";
import { pluginSourceState } from "../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceState.mjs";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/lib/core/transform/project/collectProjectInputSnapshot.mjs";
import { walkSnapshotComplete } from "../../../../../packages/unplugin/lib/core/transform/validation/walkSnapshotComplete.mjs";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../packages/unplugin/lib/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY.mjs";
import { createClockRollbackFixture } from "../../internal/clock-rollback/createClockRollbackFixture";

/**
 * Verifies a failed generation's replay reads a plugin source's files again
 * once the filesystem's clock stepped back, rather than trusting their metadata
 * against a reference minted before the rollback.
 *
 * A terminal verdict is confirmed once per event-loop turn by metadata first
 * (samchon/ttsc#1398): a file whose separable signature still matches keeps its
 * recorded state, and a plugin source keeps its digest while its files'
 * metadata holds (`pluginSourceFilesDigest`). Separable is decided against the
 * current clock reference. The replay used to take whatever reference a
 * delivery had last minted, since the failed generation's own probe directory
 * is released with it, so after a clock rollback put a write into a recorded
 * stamp's tick, the old reference still called the stamp finished, and the
 * replay kept serving the old failure. The confirmation now mints its own
 * reference first, in the probe directory its process keeps, as a delivery
 * does.
 *
 * 1. Record a failed generation whose recorded inputs hold a plugin source, after
 *    an earlier proof minted a reference, and assert the confirmation finds
 *    nothing changed.
 * 2. Hold the source's file metadata, change a file's bytes, and assert the
 *    confirmation still finds nothing changed: its metadata stands for the
 *    bytes while the clock is where it was.
 * 3. Step the filesystem's clock back, and assert the confirmation now reads the
 *    files and finds the change.
 */
export async function test_failed_generation_replay_reads_a_plugin_source_after_a_clock_rollback(): Promise<void> {
  const fixture = createClockRollbackFixture();
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
  const validation: TtscFailedGenerationValidation = {
    cached,
    declaredInputs: undefined,
    inputStates: new Map([
      [
        fixture.source,
        { state: pluginSourceState(fixture.source)!, tree: true },
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
