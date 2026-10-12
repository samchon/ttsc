import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
import { TestProject } from "../../../../utils/src/TestProject";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies a creation flag on an edit of an older file does not make a rename.
 *
 * FSEvents keeps ItemCreated on later writes to a path it saw created, so a
 * plain edit of a file created before the stream opened used to arrive as a
 * rename, a membership change. An object born before the stream opened was not
 * created in it, so its other flags decide.
 *
 * 1. Create a file, then open a recursive watch over its directory.
 * 2. Deliver created-and-modified for it, and the same with a removal flag.
 * 3. Create a second file after the stream opened and deliver created-and-
 *    modified for it.
 * 4. Assert the older file's edit is a change, while the removal and the newer
 *    file stay renames.
 *
 * @evidence contracts/testing.md#behavioral-verification FseventsStreams dispatches injected native flags for real files whose birth times the actual lstat reads.
 * @evidence contracts/testing.md#independent-expectations Creation order around the stream's opening, separated by a wait, sets which file was born before it; literal flag values and event names set the expectations.
 * @evidence contracts/testing.md#distinguishing-cases An older file's edit, the same with a removal flag, and a newer file's creation are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit opens an injected FakeFseventsBinding stream over a real temporary directory; it loads no fsevents binding and opens no OS watch. A volume reporting no birth time skips only the newer-file row.
 */
export const test_fsevents_streams_classify_a_late_creation_flag_by_birth =
  (): void => {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-fsevents-birth-"),
    );
    const older = path.join(root, "older.ts");
    fs.writeFileSync(older, "export const older = 1;\n");
    pause(30);
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const events: Array<[string, string | null]> = [];
    const watch = registry.open(root, true, (event, name) => {
      events.push([event, name]);
    });
    try {
      binding.emit(0, older, 0x100 | 0x1000);
      binding.emit(0, older, 0x100 | 0x200 | 0x1000);
      assert.deepEqual(events, [
        ["change", "older.ts"],
        ["rename", "older.ts"],
      ]);

      pause(30);
      const newer = path.join(root, "newer.ts");
      fs.writeFileSync(newer, "export const newer = 1;\n");
      if (fs.lstatSync(newer).birthtimeMs > 0) {
        events.length = 0;
        binding.emit(0, newer, 0x100 | 0x1000);
        assert.deepEqual(events, [["rename", "newer.ts"]]);
      }
    } finally {
      watch.close();
    }
  };

/** Wait long enough for birth times on either side to differ. */
function pause(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
