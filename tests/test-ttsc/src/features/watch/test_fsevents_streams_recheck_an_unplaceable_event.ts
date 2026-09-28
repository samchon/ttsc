import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/lib/launcher/internal/watch/FseventsStreams.js";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies a path outside one stream rechecks only that stream's watches.
 *
 * An event outside the root cannot be placed against its watched directories.
 * Treating it as silence could strand a changed input, while notifying an
 * unrelated stream would make that project rescan for another one's event.
 *
 * 1. Open watches on two disjoint roots.
 * 2. Have the first stream report a path outside its own root.
 * 3. Assert only its watch receives an unnamed recheck.
 */
export const test_fsevents_streams_recheck_an_unplaceable_event = (): void => {
  const parent = path.resolve("fsevents-unplaceable");
  const first = path.join(parent, "first");
  const second = path.join(parent, "second");
  const binding = new FakeFseventsBinding();
  const registry = new FseventsStreams(binding);
  const firstEvents: Array<[string, string | null]> = [];
  const secondEvents: Array<[string, string | null]> = [];
  const firstWatch = registry.open(first, false, (event, name) => {
    firstEvents.push([event, name]);
  });
  const secondWatch = registry.open(second, false, (event, name) => {
    secondEvents.push([event, name]);
  });

  binding.emit(0, path.join(second, "main.ts"), 0x1000);
  assert.deepEqual(firstEvents, [["rename", null]]);
  assert.deepEqual(secondEvents, []);
  secondWatch.close();
  firstWatch.close();
};
