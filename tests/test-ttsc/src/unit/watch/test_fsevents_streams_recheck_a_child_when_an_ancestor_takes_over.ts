import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies an ancestor starts before child streams stop and closes their gap.
 *
 * The native binding aborts callbacks still queued when a stream stops. An
 * event queued just before an ancestor opens is older than the new stream and
 * would be lost, so each transferred watch receives one unnamed recheck.
 *
 * 1. Open a child stream and queue an edit during its ancestor's opening.
 * 2. Open the ancestor and assert the child receives an unnamed recheck.
 * 3. Assert the retired stream is silent and the new stream delivers edits.
 */
export const test_fsevents_streams_recheck_a_child_when_an_ancestor_takes_over =
  async (): Promise<void> => {
    const root = path.resolve("fsevents-takeover", "project");
    const child = path.join(root, "src");
    const file = path.join(child, "main.ts");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const childEvents: Array<[string, string | null]> = [];
    const ancestorEvents: Array<[string, string | null]> = [];
    const nested = registry.open(child, false, (event, name) => {
      childEvents.push([event, name]);
    });
    binding.onOpen = (location) => {
      if (location === root) binding.queue(0, file, 0x1000);
    };

    const ancestor = registry.open(root, true, (event, name) => {
      ancestorEvents.push([event, name]);
    });
    await Promise.resolve();
    assert.equal(binding.streams.length, 2);
    assert.equal(binding.streams[0]?.stops, 1);
    binding.flush(0);
    assert.deepEqual(childEvents, [["rename", null]]);
    binding.emit(0, file, 0x1000);
    assert.deepEqual(childEvents, [["rename", null]]);

    binding.emit(1, file, 0x1000);
    assert.deepEqual(childEvents, [
      ["rename", null],
      ["change", "main.ts"],
    ]);
    assert.deepEqual(ancestorEvents, [["change", path.join("src", "main.ts")]]);
    ancestor.close();
    nested.close();
  };
