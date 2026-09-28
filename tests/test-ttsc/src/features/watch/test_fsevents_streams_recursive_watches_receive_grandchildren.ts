import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/lib/launcher/internal/watch/FseventsStreams.js";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies a recursive watch receives a grandchild by its relative path.
 *
 * FSEvents names an absolute entry. The watch consumer needs the path below
 * its own root, while a nonrecursive sibling must not hear that grandchild.
 *
 * 1. Open recursive and nonrecursive watches on one directory.
 * 2. Deliver an event below a subdirectory.
 * 3. Assert only the recursive watch receives the relative path.
 */
export const test_fsevents_streams_recursive_watches_receive_grandchildren =
  (): void => {
    const root = path.resolve("fsevents-recursive", "project");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const recursiveEvents: Array<[string, string | null]> = [];
    const plainEvents: Array<[string, string | null]> = [];
    const recursive = registry.open(root, true, (event, name) => {
      recursiveEvents.push([event, name]);
    });
    const plain = registry.open(root, false, (event, name) => {
      plainEvents.push([event, name]);
    });

    binding.emit(0, path.join(root, "nested", "deep.ts"), 0x1000);
    assert.deepEqual(recursiveEvents, [
      ["change", path.join("nested", "deep.ts")],
    ]);
    assert.deepEqual(plainEvents, []);
    plain.close();
    recursive.close();
  };
