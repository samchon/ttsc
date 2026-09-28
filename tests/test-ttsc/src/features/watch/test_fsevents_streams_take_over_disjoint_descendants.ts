import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/lib/launcher/internal/watch/FseventsStreams.js";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies one ancestor stream takes over every disjoint descendant stream.
 *
 * An index that finds only one child leaves the other bound to a redundant
 * stream, so closing or replacing watches would still disturb its delivery.
 * Both transferred watches must also re-read the handoff interval.
 *
 * 1. Open watches on two sibling directories, each with its own stream.
 * 2. Open their ancestor and let the transfer rechecks run.
 * 3. Assert both child streams stop and both watches receive later events.
 */
export const test_fsevents_streams_take_over_disjoint_descendants =
  async (): Promise<void> => {
    const root = path.resolve("fsevents-two-children", "project");
    const left = path.join(root, "left");
    const right = path.join(root, "right");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const leftEvents: Array<[string, string | null]> = [];
    const rightEvents: Array<[string, string | null]> = [];
    const leftWatch = registry.open(left, false, (event, name) => {
      leftEvents.push([event, name]);
    });
    const rightWatch = registry.open(right, false, (event, name) => {
      rightEvents.push([event, name]);
    });

    const ancestor = registry.open(root, true, () => undefined);
    await Promise.resolve();
    assert.equal(binding.streams[0]?.stops, 1);
    assert.equal(binding.streams[1]?.stops, 1);
    assert.deepEqual(leftEvents, [["rename", null]]);
    assert.deepEqual(rightEvents, [["rename", null]]);

    binding.emit(2, path.join(left, "a.ts"), 0x1000);
    binding.emit(2, path.join(right, "b.ts"), 0x1000);
    assert.deepEqual(leftEvents.at(-1), ["change", "a.ts"]);
    assert.deepEqual(rightEvents.at(-1), ["change", "b.ts"]);
    ancestor.close();
    leftWatch.close();
    rightWatch.close();
  };
