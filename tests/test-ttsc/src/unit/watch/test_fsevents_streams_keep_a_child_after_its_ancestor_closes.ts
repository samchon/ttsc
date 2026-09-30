import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies closing an ancestor watch keeps a child watch delivering.
 *
 * A stream belongs to every watch it serves, not just the watch at its root.
 * Closing the latter must leave the stream open until the last child closes.
 *
 * 1. Open a child stream, then an ancestor that takes it over.
 * 2. Close the ancestor and deliver a child event.
 * 3. Assert the child hears it and its close alone stops the stream.
 */
export const test_fsevents_streams_keep_a_child_after_its_ancestor_closes =
  async (): Promise<void> => {
    const root = path.resolve("fsevents-close", "project");
    const child = path.join(root, "src");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const events: Array<[string, string | null]> = [];
    const nested = registry.open(child, false, (event, name) => {
      events.push([event, name]);
    });
    const ancestor = registry.open(root, true, () => undefined);
    await Promise.resolve();
    events.length = 0;

    ancestor.close();
    ancestor.close();
    assert.equal(binding.streams[1]?.stops, 0);
    binding.emit(1, path.join(child, "main.ts"), 0x1000);
    assert.deepEqual(events, [["change", "main.ts"]]);

    nested.close();
    assert.equal(binding.streams[1]?.stops, 1);
    binding.emit(1, path.join(child, "main.ts"), 0x1000);
    assert.deepEqual(events, [["change", "main.ts"]]);
  };
