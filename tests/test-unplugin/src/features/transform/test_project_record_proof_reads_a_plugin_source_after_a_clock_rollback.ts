import assert from "node:assert/strict";
import path from "node:path";

import type { TtscProjectRecord } from "../../../../../packages/unplugin/src/core/bridge/TtscProjectRecord";
import { projectRecordMoved } from "../../../../../packages/unplugin/src/core/bridge/projectRecordMoved";
import { pluginSourceState } from "../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import { createClockRollbackUnitFixture } from "../../internal/transform-project-cache/createClockRollbackUnitFixture";

/**
 * Verifies projectRecordMoved stops reusing held plugin-source metadata when
 * the current filesystem clock reference falls behind those stamps.
 *
 * The bytes change while the supported filesystem view holds source metadata. A
 * newly minted probe under the authored rollback must withdraw the old
 * separability premise. Real Go environment inputs are preserved, not mocked.
 *
 * 1. Record real source state and require the unchanged proof's first verdict.
 * 2. Hold real source stamps and edit bytes; require the recorded digest to hold.
 * 3. Apply the outside probe's two-hour timestamp step and require rereading.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual projectRecordMoved through its existing recorded-input boundary and requires undefined/undefined/source, without generation or membership authority. The rollback row detects reuse of a digest whose metadata is no longer separable from the current clock.
 * @evidence contracts/testing.md#independent-expectations Actual appended bytes, held pre-edit BigIntStats and literal -7200000000000n probe offset independently establish the changed validity premise. Literal three-state verdicts follow that premise; the recorded pluginSourceState is setup rather than an independent digest-encoding oracle.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged source contrasts with edited bytes under retained metadata, then the same edit under a current rolled-back probe. The other two direct entries own the other proof consumers. Authored record/generation/tracker fields are supported comparator inputs, not claims that native capture produced them.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit owns its three verdicts using a suite-owned helper and the original package-owned fixture bytes. Real source and Go env/version/GOROOT observations remain owning input capabilities; no compiler/plugin build, native notification backend, installed consumer or host runs. Controlled rollback does not assert an actual host-clock rollback or transported native coverage.
 */
export function test_project_record_proof_reads_a_plugin_source_after_a_clock_rollback(): void {
  const fixture = createClockRollbackUnitFixture();
  fixture.settle();
  fixture.mintEarlier();
  const recordedState = pluginSourceState(fixture.source);
  assert.ok(
    recordedState,
    "actual source and native environment must be readable",
  );
  const record: TtscProjectRecord = {
    inputs: {
      [fixture.source]: {
        identity: fixture.source,
        missing: false,
        state: { codec: "tree", digest: recordedState },
      },
    },
    membership: null,
    root: fixture.project,
    signal: 0,
    tsconfig: path.join(fixture.project, "tsconfig.json"),
  };
  const moved = () => projectRecordMoved(record, fixture.filesystem);

  // 1. Nothing moved.
  assert.equal(moved(), undefined);

  // 2. Held metadata stands for the bytes.
  fixture.hold();
  fixture.edit();
  assert.equal(moved(), undefined, "the metadata holds, so the digest does");

  // 3. After a rollback, the files are read.
  fixture.stepBack();
  assert.equal(
    moved(),
    fixture.source,
    "a reference minted since the rollback puts the stamps inside it",
  );
}
