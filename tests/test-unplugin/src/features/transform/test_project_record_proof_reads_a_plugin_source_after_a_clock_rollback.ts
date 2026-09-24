import assert from "node:assert/strict";
import path from "node:path";

import type { TtscProjectRecord } from "../../../../../packages/unplugin/lib/core/bridge/TtscProjectRecord.mjs";
import { projectRecordMoved } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordMoved.mjs";
import { pluginSourceState } from "../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceState.mjs";
import { createClockRollbackFixture } from "../../internal/clock-rollback/createClockRollbackFixture";

/**
 * Verifies a build start's proof of a project record reads a plugin source's
 * files again once the filesystem's clock stepped back, rather than trusting
 * their metadata against a reference minted before the rollback.
 *
 * A build start proves each recorded input against the disk
 * (`projectRecordMoved`), a plugin source by the state its build keyed on,
 * whose digest is kept while its files' metadata holds
 * (`pluginSourceFilesDigest`). That metadata stands for the bytes only against
 * a clock reference minted since any rollback. The proof holds no generation
 * and used to mint none, so it judged against whatever reference was last
 * minted, and a write a rollback put into a recorded stamp's tick left the
 * record unmoved, and the host's cache serving the old output. The proof now
 * mints its own reference first, in scratch storage outside the project.
 *
 * 1. Record a project whose inputs hold a plugin source, after an earlier proof
 *    minted a reference, and assert the proof finds the record current.
 * 2. Hold the source's file metadata, change a file's bytes, and assert the record
 *    still stands: its metadata stands for the bytes while the clock is where
 *    it was.
 * 3. Step the filesystem's clock back, and assert the proof now reads the files
 *    and names the plugin source as moved.
 */
export function test_project_record_proof_reads_a_plugin_source_after_a_clock_rollback(): void {
  const fixture = createClockRollbackFixture();
  fixture.settle();
  fixture.mintEarlier();
  const record: TtscProjectRecord = {
    inputs: {
      [fixture.source]: {
        identity: fixture.source,
        missing: false,
        state: { codec: "tree", digest: pluginSourceState(fixture.source)! },
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
