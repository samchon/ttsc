import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../../../../../packages/unplugin/src/core/transform/clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { pluginSourceState } from "../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/TtscHostInputValidation";
import { notificationsProveProgramUnchanged } from "../../../../../packages/unplugin/src/core/transform/validation/notificationsProveProgramUnchanged";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../packages/unplugin/src/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { createClockRollbackUnitFixture } from "../../internal/transform-project-cache/createClockRollbackUnitFixture";

/**
 * Verifies notificationsProveProgramUnchanged stops reusing held plugin-source metadata
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
 * @evidence contracts/testing.md#behavioral-verification Calls actual notificationsProveProgramUnchanged through its existing recorded-input boundary and requires true/true/false, with the source explicitly outside the host tracker's proven notification scopes. The rollback row detects reuse of a digest whose metadata is no longer separable from the current clock.
 * @evidence contracts/testing.md#independent-expectations Actual appended bytes, held pre-edit BigIntStats and literal -7200000000000n probe offset independently establish the changed validity premise. Literal three-state verdicts follow that premise; the recorded pluginSourceState is setup rather than an independent digest-encoding oracle.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged source contrasts with edited bytes under retained metadata, then the same edit under a current rolled-back probe. The other two direct entries own the other proof consumers. Authored record/generation/tracker fields are supported comparator inputs, not claims that native capture produced them.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit owns its three verdicts using a suite-owned helper and the original package-owned fixture bytes. Real source and Go env/version/GOROOT observations remain owning input capabilities; no compiler/plugin build, native notification backend, installed consumer or host runs. Controlled rollback does not assert an actual host-clock rollback or transported native coverage.
 */
export function test_out_of_program_proof_reads_a_plugin_source_after_a_clock_rollback(): void {
  const fixture = createClockRollbackUnitFixture();
  const probes = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-clock-rollback-probes-"),
  );
  fixture.settle();
  fixture.mintEarlier();
  const recordedState = pluginSourceState(fixture.source);
  assert.ok(recordedState, "actual source and native environment must be readable");
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
    trees: new Map([[fixture.source, recordedState]]),
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
