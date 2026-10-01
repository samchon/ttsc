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
 * mints its own reference first, in the probe directory its process keeps.
 *
 * 1. Record a project whose inputs hold a plugin source, after an earlier proof
 *    minted a reference, and assert the proof finds the record current.
 * 2. Hold the source's file metadata, change a file's bytes, and assert the record
 *    still stands: its metadata stands for the bytes while the clock is where
 *    it was.
 * 3. Step the filesystem's clock back, and assert the proof now reads the files
 *    and names the plugin source as moved.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls projectRecordMoved on a record with a tree-state input; asserts no moved path initially or after an edit with held metadata, then the source path is returned once the filesystem clock rolls back.
 * @evidence contracts/testing.md#independent-expectations A record can authorize host cache reuse only while its input proof holds under a current clock reference. The written bytes and injected timestamp step independently specify the moved-source result; recorded plugin state is not an independent digest-format oracle.
 * @evidence contracts/testing.md#distinguishing-cases Owns the build-start record consumer without a retained generation and its unchanged/held-edit/rollback distinctions; replay and out-of-program entries pin the other consumers.
 * @evidence contracts/testing.md#execution-ownership E2E entry calls built projectRecordMoved with a supplied filesystem but the source-state provider still probes the real Go environment. There is no installed bundler or native compiler build.
 * @evidence contracts/e2e.md#necessary-boundary The record decoder/proof consumes real ttsc source/toolchain state outside the clock fixture seam. This pins that consumer connection, though clock invalidation is portable logic that currently lacks an isolated environment-provider injection.
 * @evidence contracts/e2e.md#shared-execution One recorded source and earlier clock mint support all three states; the existing toolchain and packages are shared, and provider memoization reuses equivalent environment probes. No host or plugin compilation is repeated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture owns metadata holding and rollback; its unique project/source paths prevent prior entries from supplying record state. TestProject removes those paths at process exit; the retained process clock directory is production-owned until exit.
 * @evidence contracts/e2e.md#preserved-coverage All no-move/no-move/source-moved assertions remain unchanged. Native host cache replay belongs to adapter boundaries; the portable record proof still has no separate pure-unit ownership here.
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
