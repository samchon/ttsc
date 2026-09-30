import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies every FSEvents loss flag rechecks every watch on its stream.
 *
 * The binding exposes must-scan, dropped-event, wrapped-id, changed-root,
 * mount, and unmount notices that libuv discards. An unnamed event makes each
 * topology consumer compare its observed bytes rather than trust a file name or
 * a timestamp that may not have moved.
 *
 * 1. Open recursive and nonrecursive watches served by one stream.
 * 2. Deliver each loss flag, then an ordinary named modification.
 * 3. Assert every loss reaches both watches unnamed and the edit stays named.
 *
 * @evidence contracts/testing.md#behavioral-verification FseventsStreams.open callbacks fan each of seven loss flags out to recursive and nonrecursive subscribers as unnamed gap rechecks, then preserve ordinary named modification delivery.
 * @evidence contracts/testing.md#independent-expectations The supported loss flags 0x1, 0x2, 0x4, 0x8, 0x20, 0x40 and 0x80 require reinspection. Literal seven rename/null/true tuples and subsequent change names independently specify the protocol.
 * @evidence contracts/testing.md#distinguishing-cases The loop owns each enumerated loss flag on the same shared stream; both recursion modes must recheck. Modification 0x1000 is the negative gap control and must retain its relative name with no gap value.
 * @evidence contracts/testing.md#execution-ownership This one exported source-unit entry owns all seven flag inputs and the ordinary control, using injected FakeFseventsBinding.emit. It executes registry dispatch only, without native loading or OS event production.
 */
export const test_fsevents_streams_recheck_every_watch_after_gap_flags =
  (): void => {
    const root = path.resolve("fsevents-gap", "project");
    const child = path.join(root, "src");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const ancestorEvents: Array<[string, string | null, boolean | undefined]> =
      [];
    const childEvents: Array<[string, string | null, boolean | undefined]> = [];
    const ancestor = registry.open(root, true, (event, name, gap) => {
      ancestorEvents.push([event, name, gap]);
    });
    const nested = registry.open(child, false, (event, name, gap) => {
      childEvents.push([event, name, gap]);
    });

    for (const flag of [0x1, 0x2, 0x4, 0x8, 0x20, 0x40, 0x80]) {
      binding.emit(0, child, flag);
    }
    assert.deepEqual(ancestorEvents, Array(7).fill(["rename", null, true]));
    assert.deepEqual(childEvents, Array(7).fill(["rename", null, true]));
    binding.emit(0, path.join(child, "main.ts"), 0x1000);
    assert.deepEqual(ancestorEvents.at(-1), [
      "change",
      path.join("src", "main.ts"),
      undefined,
    ]);
    assert.deepEqual(childEvents.at(-1), ["change", "main.ts", undefined]);
    nested.close();
    ancestor.close();
  };
