import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectRecordDigest } from "../../../../../packages/unplugin/src/core/bridge/projectRecordDigest";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { refreshProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/refreshProjectRecordFile";
import { TtscProjectRecordUnwritableError } from "../../../../../packages/unplugin/src/core/transform/errors/TtscProjectRecordUnwritableError";
import type { TtscProjectRegistration } from "../../../../../packages/unplugin/src/core/transform/watch/TtscProjectRegistration";
import { notifyProjectRecord } from "../../../../../packages/unplugin/src/core/transform/watch/notifyProjectRecord";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies an accepted record must remain available for each handoff.
 *
 * These are persistence-owner calls over actual files and a literal generation,
 * without claiming that a compiler produced or admitted that generation.
 *
 * 1. Reuse one snapshot and digest while repeating callback effects; leave
 *    corrupt existing bytes to the record reader's proof.
 * 2. Remove the config, refresh its accepted record, restore exact bytes and
 *    recover with both the same generation and a fresh-generation control.
 * 3. Block removed primary/fallback locations with ordinary files and require
 *    fallback recovery, watching refusal or unchanged failed/one-shot semantics.
 * 4. Replace an accepted file with a directory or dangling link, then restore
 *    a regular target and retain the host's lexical record spelling.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual notifyProjectRecord and refreshProjectRecordFile calls must hand over existing regular records with matching written digests after removal. Repeated callbacks, one input derivation, stable snapshot, corrupt-existing bytes, fallback repair and typed watching refusal distinguish persistence recovery from generation recapture and content proof.
 * @evidence contracts/testing.md#independent-expectations Exact fixture config bytes and the public handoff contract require a usable file before success. Literal registration counts, original snapshot identity, original corrupt bytes, independently hashed persisted bytes and the typed error distinguish unavailable paths from accepted records.
 * @evidence contracts/testing.md#distinguishing-cases Existing versus removed, same versus fresh generation, primary versus fallback, both blocked versus repaired, success versus failed/one-shot, directory versus regular target and dangling versus resolved link retain separate assertions. Each scenario runs even after another fails; a failed prerequisite blocks only its scenario.
 * @evidence contracts/testing.md#execution-ownership The named unit directly runs persistence, refresh and digest operations in process over a private fixture root. It starts no compiler, installed consumer or product host. The selected webpack batch separately owns actual native generation reuse and independent host opening.
 */
export function test_project_record_recovers_an_accepted_missing_path(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const root = path.dirname(fixture.good.tsconfig);
  const failures: unknown[] = [];
  const run = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const scenario = (name: string) => {
    const cached = { ...fixture.good };
    const toolDirectory = path.join(root, ".ttsc", name);
    const handed: TtscProjectRegistration[] = [];
    let reads = 0;
    const project = {
      toolDirectory,
      watching: true,
      register: (registration: TtscProjectRegistration): void => {
        handed.push(registration);
      },
    };
    const deliver = (
      options: { fallbackToolDirectory?: string; watching?: boolean } = {},
      failed = false,
    ): boolean =>
      notifyProjectRecord({ ...project, ...options }, cached, failed, () => {
        ++reads;
        return [{ file: fixture.good.tsconfig }];
      });
    assert.equal(deliver(), true);
    const record = handed[0]!.record;
    const verify = (): void => {
      const latest = handed.at(-1)!;
      assert.equal(fs.statSync(latest.record).isFile(), true);
      assert.ok(readProjectRecordFile(latest.record));
      assert.equal(
        latest.digest,
        projectRecordDigest(fs.readFileSync(latest.record, "utf8")),
      );
    };
    verify();
    return { cached, deliver, handed, project, reads: () => reads, record, verify };
  };
  try {
    run("accepted memo and reader-owned corrupt bytes", () => {
      const state = scenario("existing");
      const first = state.handed[0]!;
      assert.equal(state.deliver(), true);
      assert.equal(state.reads(), 1);
      assert.equal(state.handed.length, 2);
      assert.equal(state.handed[1]!.inputs(), first.inputs());
      assert.equal(state.handed[1]!.digest, first.digest);
      fs.writeFileSync(state.record, "corrupt existing record");
      assert.equal(state.deliver(), true);
      assert.equal(fs.readFileSync(state.record, "utf8"), "corrupt existing record");
      assert.equal(state.handed[2]!.digest, first.digest);
      assert.equal(readProjectRecordFile(state.record), undefined);
      fs.unlinkSync(state.record);
      assert.equal(state.deliver(), true);
      state.verify();
      assert.equal(state.handed[3]!.inputs(), first.inputs());
      assert.equal(state.reads(), 1);
    });
    run("refresh removal and exact restoration", () => {
      const state = scenario("refresh");
      const config = fs.readFileSync(fixture.good.tsconfig);
      try {
        fs.unlinkSync(fixture.good.tsconfig);
        refreshProjectRecordFile(state.record);
        assert.equal(fs.existsSync(state.record), false);
      } finally {
        fs.writeFileSync(fixture.good.tsconfig, config);
      }
      assert.equal(state.deliver(), true);
      state.verify();
      assert.equal(state.reads(), 1);
      fs.unlinkSync(state.record);
      assert.equal(
        notifyProjectRecord(state.project, { ...state.cached }, false, () => []),
        true,
      );
      state.verify();
    });
    run("removed primary and fallback recover independently", () => {
      const state = scenario("fallback");
      fs.unlinkSync(state.record);
      fs.rmdirSync(path.dirname(state.record));
      fs.writeFileSync(path.dirname(state.record), "blocked primary");
      const fallbackToolDirectory = path.join(root, ".ttsc", "fallback-target");
      assert.equal(state.deliver({ fallbackToolDirectory }), true);
      state.verify();
      const fallback = state.handed.at(-1)!.record;
      assert.equal(path.dirname(path.dirname(fallback)), fallbackToolDirectory);
      fs.unlinkSync(fallback);
      assert.equal(state.deliver({ fallbackToolDirectory }), true);
      state.verify();
      assert.equal(state.reads(), 1);
    });
    run("unavailable accepted records preserve delivery failure policy", () => {
      const state = scenario("refusal");
      fs.unlinkSync(state.record);
      fs.rmdirSync(path.dirname(state.record));
      fs.writeFileSync(path.dirname(state.record), "blocked primary");
      const fallbackToolDirectory = path.join(root, ".ttsc", "blocked-fallback");
      fs.writeFileSync(fallbackToolDirectory, "blocked fallback");
      assert.throws(
        () => state.deliver({ fallbackToolDirectory }),
        (error) =>
          error instanceof TtscProjectRecordUnwritableError &&
          error.record === state.record &&
          error.cause !== undefined,
      );
      assert.equal(state.deliver({ fallbackToolDirectory, watching: false }), false);
      assert.equal(state.deliver({ fallbackToolDirectory }, true), false);
      assert.equal(state.handed.length, 1);
      fs.unlinkSync(path.dirname(state.record));
      assert.equal(state.deliver(), true);
      state.verify();
      assert.equal(state.reads(), 1);
    });
    run("a directory is not an accepted record", () => {
      const state = scenario("directory");
      fs.unlinkSync(state.record);
      fs.mkdirSync(state.record);
      assert.throws(() => state.deliver(), TtscProjectRecordUnwritableError);
      assert.equal(state.handed.length, 1);
      fs.rmdirSync(state.record);
      assert.equal(state.deliver(), true);
      state.verify();
    });
    run("dangling and restored record target keep lexical spelling", () => {
      const state = scenario("link");
      const targetDirectory = path.join(root, ".ttsc", "linked-target");
      fs.mkdirSync(targetDirectory);
      const parent = path.dirname(state.record);
      const targetRecord = path.join(targetDirectory, path.basename(state.record));
      fs.renameSync(state.record, targetRecord);
      fs.rmdirSync(parent);
      fs.symlinkSync(targetDirectory, parent, "junction");
      assert.equal(state.deliver(), true);
      state.verify();
      assert.equal(state.handed.at(-1)!.record, state.record);
      fs.unlinkSync(targetRecord);
      fs.rmdirSync(targetDirectory);
      // A missing linked parent is recovered by the writer where supported;
      // otherwise the established watching refusal must survive.
      try {
        assert.equal(state.deliver(), true);
        state.verify();
      } catch (error) {
        assert.ok(error instanceof TtscProjectRecordUnwritableError);
      }
      fs.mkdirSync(targetDirectory, { recursive: true });
      assert.equal(state.deliver(), true);
      state.verify();
      assert.equal(state.handed.at(-1)!.record, state.record);
      assert.equal(state.reads(), 1);
    });
  } finally {
    fixture.dispose();
  }
  if (failures.length)
    throw new AggregateError(failures, "accepted project record recovery");
}
