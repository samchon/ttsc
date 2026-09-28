import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/lib/launcher/internal/watch/FseventsStreams.js";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies a nested directory watch joins an open ancestor stream.
 *
 * FSEvents streams are recursive. Opening another stream for each descendant
 * would spend a native resource per consumer and disturb observation during
 * registration, so the registry indexes both watches under one stream.
 *
 * 1. Open recursive project and nonrecursive source-directory watches.
 * 2. Deliver a direct source event through the one binding stream.
 * 3. Assert each watch receives its own relative name and one stream closes.
 */
export const test_fsevents_streams_share_an_ancestor_stream_with_nested_watches =
  (): void => {
    const root = path.resolve("fsevents-nested", "project");
    const source = path.join(root, "src");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const projectEvents: Array<[string, string | null]> = [];
    const sourceEvents: Array<[string, string | null]> = [];
    const project = registry.open(root, true, (event, name) => {
      projectEvents.push([event, name]);
    });
    const nested = registry.open(source, false, (event, name) => {
      sourceEvents.push([event, name]);
    });

    assert.equal(binding.streams.length, 1);
    binding.emit(0, path.join(source, "main.ts"), 0x1000);
    assert.deepEqual(projectEvents, [["change", path.join("src", "main.ts")]]);
    assert.deepEqual(sourceEvents, [["change", "main.ts"]]);
    binding.emit(0, path.join(root, "other.ts"), 0x1000);
    assert.deepEqual(projectEvents.at(-1), ["change", "other.ts"]);
    assert.deepEqual(sourceEvents, [["change", "main.ts"]]);

    nested.close();
    project.close();
    assert.equal(binding.streams[0]?.stops, 1);
  };
