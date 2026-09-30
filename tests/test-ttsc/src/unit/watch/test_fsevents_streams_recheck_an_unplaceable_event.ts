import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
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
 *
 * @evidence contracts/testing.md#behavioral-verification FseventsStreams.open callbacks convert a path outside the emitting stream into one unnamed recheck and leave the other disjoint stream silent.
 * @evidence contracts/testing.md#independent-expectations An unplaceable callback makes only its owning stream observations uncertain. Literal rename/null for firstEvents and an empty secondEvents vector distinguish loss reporting from silence or cross-stream dispatch.
 * @evidence contracts/testing.md#distinguishing-cases Two live disjoint roots provide the isolation control; stream zero reports a valid path under the other root. Ordinary in-root delivery is covered by share_an_ancestor_stream_with_nested_watches.
 * @evidence contracts/testing.md#execution-ownership This exported source unit creates two registry streams through FakeFseventsBinding and injects the mismatched callback with emit. Both handles are closed; no actual native stream or kernel event is involved.
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
