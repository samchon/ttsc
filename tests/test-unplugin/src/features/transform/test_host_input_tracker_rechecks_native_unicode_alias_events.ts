import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies uncertain native Unicode events withdraw notification-only proof.
 *
 * A lexical filename comparison cannot establish native Unicode normalization
 * equivalence. Uncertainty must retain metadata validation instead of silently
 * certifying an unchanged input or inventing a membership change.
 *
 * 1. Open an exact-input tracker with a controlled watcher and supplied case
 *    policy.
 * 2. Require reproof for unresolved ASCII names and Unicode aliases in both
 *    directions.
 * 3. On Windows require revalidation for unmatched ASCII and short-name events,
 *    while a natively resolved existing alias records its definite mutation.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createHostInputMutationTracker through its watch seam. Unresolved ASCII names and Unicode spelling uncertainty set unverified without inventing membershipChanged. Native stat and realpath independently distinguish a currently resolved ASCII alias, which records its exact mutation instead. Every fresh tracker closes its one handle in finally.
 * @evidence contracts/testing.md#independent-expectations Unicode code-unit inequality does not rule out native aliasing. Microsoft's FILE_NOTIFY_INFORMATION allows long or short event names and SetFileShortNameW allows caller-assigned NTFS aliases. Native stat device/inode and realpath equality distinguish the existing ASCII alias without invoking the tracker as an oracle. Unverified true withdraws uncertain authority and membershipChanged false preserves uncertainty; a currently resolved alias instead records membershipChanged true and its reported path.
 * @evidence contracts/testing.md#distinguishing-cases Fresh rows cover unresolved ordinary names, composed/decomposed, Kelvin-to-ASCII and Unicode-requested unmatched ASCII events; Windows adds both long/short directions, including a genuinely resolved existing alias when the native filesystem provides one. An event's code units alone cannot certify irrelevance on other filesystem views either. The observer's unchanged-input case owns the adjacent quiet-state negative. Metadata validation owns the subsequent content verdict.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin runner discovers this async entry and calls authored tracker construction over a real temporary tree through supplied watch/caseSensitive capabilities. Events are invoked in-process; no native watcher, broker or compiler runs. Tracker close executes in finally.
 */
export async function test_host_input_tracker_rechecks_native_unicode_alias_events(): Promise<void> {
  const failures: Error[] = [];
  for (const [name, event, uncertain] of [
    ["ordinary.config", "unrelated.config", true],
    ["\u00e9.config", "e\u0301.config", true],
    ["\u212a.config", "K.config", true],
    ["\u00e9.config", "unrelated.config", true],
    ...(process.platform === "win32"
      ? ([
          ["LongConfig.config", "LONGCO~1.CON", true],
          ["LONGCO~1.CON", "LongConfig.config", true],
        ] as const)
      : []),
  ] as const) {
    try {
      await assertTrackerAuthority(name, event, uncertain);
    } catch (cause) {
      failures.push(new Error(`${name} -> ${event}`, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Native alias tracker scenarios failed");
}

/** Each row owns fresh tracker authority and a finally-closed watch handle. */
async function assertTrackerAuthority(
  name: string,
  event: string,
  uncertain: boolean,
): Promise<void> {
  const directory = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unicode-tracker-"),
  );
  const input = path.join(directory, name);
  fs.writeFileSync(input, "{}");
  const reported = path.join(directory, event);
  let resolvedAlias = false;
  if (process.platform === "win32" && !/[^\x00-\x7f]/.test(name + event)) {
    try {
      const expected = fs.statSync(input, { bigint: true });
      const observed = fs.statSync(reported, { bigint: true });
      resolvedAlias =
        expected.dev === observed.dev &&
        expected.ino === observed.ino &&
        fs.realpathSync.native(input) === fs.realpathSync.native(reported);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  let listener: ((event: string, filename: string | null) => void) | undefined;
  let closed = 0;
  const tracker = await createHostInputMutationTracker(
    [input],
    {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      caseSensitive: () => true,
      watch: (_directory, notify) => {
        listener = notify;
        return {
          close: () => {
            ++closed;
          },
        };
      },
    },
    new Set([input]),
  );
  try {
    assert.equal(tracker.failed, false);
    assert.ok(listener);
    listener("rename", event);
    assert.equal(
      tracker.unverified,
      uncertain && !resolvedAlias ? true : undefined,
      "only justified native identity may retain notification authority",
    );
    assert.equal(
      tracker.membershipChanged,
      resolvedAlias,
      "a resolved existing alias records a mutation; uncertainty alone does not",
    );
    assert.deepEqual([...tracker.changes], resolvedAlias ? [reported] : []);
  } finally {
    tracker.close();
  }
  assert.equal(closed, 1);
}
