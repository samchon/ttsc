import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
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
 *
 * @evidence contracts/testing.md#behavioral-verification FseventsStreams.open shares one ancestor stream with a nested subscription, gives each its own relative name, isolates an ancestor-only event and stops the binding once after both close.
 * @evidence contracts/testing.md#independent-expectations Recursive stream sharing and subscriber-relative naming require one recorded stream, literal src/main.ts versus main.ts, and no nested other.ts delivery. The final stop count is a separate lifetime observation.
 * @evidence contracts/testing.md#distinguishing-cases An event in src reaches both watches; root other.ts reaches only the ancestor, providing the adjacent filtering control. Closing both verifies final shared release; keep_a_child_after_its_ancestor_closes owns partial-release behavior.
 * @evidence contracts/testing.md#execution-ownership This exported source unit registers both watches through FakeFseventsBinding and injects callbacks with emit before closing them. The recording fake verifies registry sharing without native resource acquisition.
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
