import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies a nonrecursive watch receives direct entries but no grandchildren.
 *
 * Its native stream is recursive even when the caller's directory watch is not.
 * Dispatch has to enforce that caller contract after FSEvents delivery.
 *
 * 1. Open a nonrecursive directory watch.
 * 2. Deliver an event for a direct child and one below a subdirectory.
 * 3. Assert only the direct child is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification FseventsStreams.open dispatches a direct rename to a nonrecursive subscriber and filters a grandchild from the same stream; the entire event vector rejects accidental recursive delivery.
 * @evidence contracts/testing.md#independent-expectations The DirectoryWatcher nonrecursive contract permits immediate entries only. Literal rename/direct.ts is independent of the registry path traversal; path.join supplies portable fixture paths.
 * @evidence contracts/testing.md#distinguishing-cases Uses equal rename flags for direct.ts and nested/deep.ts so directory depth alone changes eligibility. recursive_watches_receive_grandchildren owns the complementary recursive subscriber.
 * @evidence contracts/testing.md#execution-ownership This exported source unit opens an injected FakeFseventsBinding stream, emits two callbacks and closes the returned subscription. It exercises portable dispatch without loading fsevents or opening an OS watch.
 */
export const test_fsevents_streams_nonrecursive_watches_ignore_grandchildren =
  (): void => {
    const root = path.resolve("fsevents-nonrecursive", "project");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const events: Array<[string, string | null]> = [];
    const watch = registry.open(root, false, (event, name) => {
      events.push([event, name]);
    });

    binding.emit(0, path.join(root, "direct.ts"), 0x100);
    binding.emit(0, path.join(root, "nested", "deep.ts"), 0x100);
    assert.deepEqual(events, [["rename", "direct.ts"]]);
    watch.close();
  };
