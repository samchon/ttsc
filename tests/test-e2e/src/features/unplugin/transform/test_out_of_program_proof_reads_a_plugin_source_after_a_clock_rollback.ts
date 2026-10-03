import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../../../../../../packages/unplugin/lib/core/transform/clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.mjs";
import { pluginSourceState } from "../../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceState.mjs";
import type { TtscProjectMutationTracker } from "../../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import type { TtscHostInputValidation } from "../../../../../../packages/unplugin/lib/core/transform/validation/TtscHostInputValidation.mjs";
import { notificationsProveProgramUnchanged } from "../../../../../../packages/unplugin/lib/core/transform/validation/notificationsProveProgramUnchanged.mjs";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../../packages/unplugin/lib/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY.mjs";
import { createClockRollbackFixture } from "../../../internal/unplugin/internal/clock-rollback/createClockRollbackFixture";

/**
 * Verifies a delivery of a module outside the program reads a plugin source's
 * files again once the filesystem's clock stepped back, rather than trusting
 * their metadata against a reference minted before the rollback.
 *
 * While a generation's watchers prove its program unchanged, a module outside
 * it is answered without the project walk (samchon/ttsc#1398), by proving the
 * universal inputs no tracker vouches for: on macOS a plugin source outside the
 * project root, whose stream no probe proves delivered (samchon/ttsc#1453). Its
 * digest is kept while its files' metadata holds (`pluginSourceFilesDigest`),
 * which stands for the bytes only against a clock reference minted since any
 * rollback. Every other delivery proof mints one in the generation's retained
 * probe directory before it reads; this one ran before the delivery minted, so
 * a write a rollback put into a recorded stamp's tick kept the old program's
 * answer. It now mints first, as the others do.
 *
 * 1. Give a generation watchers that heard nothing and a plugin source they cannot
 *    vouch for, after an earlier delivery minted a reference, and assert the
 *    program is proven unchanged.
 * 2. Hold the source's file metadata, change a file's bytes, and assert it still
 *    is: its metadata stands for the bytes while the clock is where it was.
 * 3. Step the filesystem's clock back, and assert the proof now reads the files
 *    and no longer proves the program unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls notificationsProveProgramUnchanged on a generation whose program tracker is silent and whose source tracker is unproven; checks true before/after a metadata-held edit and false after clock rollback.
 * @evidence contracts/testing.md#independent-expectations A source write inside a rolled-back timestamp tick must invalidate notification-only reuse. Authored tracker authority and controlled file bytes establish the expected booleans; initial tree-state hashing is shared with the provider and is not a hash-format oracle.
 * @evidence contracts/testing.md#distinguishing-cases Owns the out-of-program shortcut with an unproven source, held metadata and rollback; failed replay and build-start record proofs remain separate consumers.
 * @evidence contracts/testing.md#execution-ownership E2E entry calls the built adapter proof and real ttsc source/environment provider. Its trackers are stand-ins; it builds no compiler/plugin and measures no native watch events.
 * @evidence contracts/e2e.md#necessary-boundary The built adapter consumes source state from actual Go environment discovery beyond its supplied filesystem seam. That integration remains real, while a future provider seam could isolate the portable out-of-program proof instead of retaining this mixed case.
 * @evidence contracts/e2e.md#shared-execution One generation, source fixture and generation probe directory carry all three transitions. Existing built artifacts/toolchain are reused and equivalent environment readings use the provider memo; no project host session is opened.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-local result/filesystem and cached/probe mappings separate this generation from others. Held stamps and the later rollback are intentional; TestProject owns temporary directory cleanup at worker exit, and production weak mappings follow their case objects.
 * @evidence contracts/e2e.md#preserved-coverage Unchanged, held-edit and rollback assertions remain in this entry without alteration; tracker/native-event transport is covered elsewhere. The portable proof remains mixed with environment integration, not transferred to pure units.
 */
export function test_out_of_program_proof_reads_a_plugin_source_after_a_clock_rollback(): void {
  const fixture = createClockRollbackFixture();
  const probes = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-clock-rollback-probes-"),
  );
  fixture.settle();
  fixture.mintEarlier();
  const tracker = (unproven: string[]): TtscProjectMutationTracker => ({
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    contentAuthoritative: true,
    covered: new Set([fixture.source]),
    failed: false,
    membershipChanged: false,
    unproven: new Set(unproven),
  });
  const validation: TtscHostInputValidation = {
    covered: new Set([fixture.source]),
    entries: new Map(),
    missing: new Map(),
    trees: new Map([[fixture.source, pluginSourceState(fixture.source)!]]),
  };
  const result = { type: "success", typescript: {} };
  TRANSFORM_RESULT_FILESYSTEM.set(result as never, fixture.filesystem);
  const cached = {
    hostInputMutationTracker: tracker([fixture.source]),
    hostInputValidation: validation,
    membershipPolicy: PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
    projectMutationTracker: tracker([]),
    projectRoot: fixture.project,
    result,
  } as unknown as TtscCachedProjectTransform;
  TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.set(cached, probes);
  const unchanged = () => notificationsProveProgramUnchanged(cached);

  // 1. Nothing moved.
  assert.equal(unchanged(), true);

  // 2. Held metadata stands for the bytes.
  fixture.hold();
  fixture.edit();
  assert.equal(unchanged(), true, "the metadata holds, so the digest does");

  // 3. After a rollback, the files are read.
  fixture.stepBack();
  assert.equal(
    unchanged(),
    false,
    "a reference minted since the rollback puts the stamps inside it",
  );
}
