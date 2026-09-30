import assert from "node:assert/strict";
import path from "node:path";

import { FseventsStreams } from "../../../../../packages/ttsc/src/launcher/internal/watch/FseventsStreams";
import { FakeFseventsBinding } from "../../internal/FakeFseventsBinding";

/**
 * Verifies an ancestor registration failure leaves child streams serving.
 *
 * New streams must start before any old stream is retired. If the binding
 * refuses the ancestor, moving or stopping child subscriptions first would
 * leave their inputs unwatched after the error is reported.
 *
 * 1. Open a child stream and make the binding reject its ancestor.
 * 2. Assert opening the ancestor throws without stopping the child.
 * 3. Deliver a child event and assert it still reaches its watch.
 */
export const test_fsevents_streams_keep_child_watches_when_ancestor_open_fails =
  (): void => {
    const root = path.resolve("fsevents-open-error", "project");
    const child = path.join(root, "src");
    const binding = new FakeFseventsBinding();
    const registry = new FseventsStreams(binding);
    const events: Array<[string, string | null]> = [];
    const nested = registry.open(child, false, (event, name) => {
      events.push([event, name]);
    });
    binding.beforeOpen = (location) => {
      if (location === root) throw new Error("stream unavailable");
    };

    assert.throws(
      () => registry.open(root, true, () => undefined),
      /stream unavailable/,
    );
    assert.equal(binding.streams.length, 1);
    assert.equal(binding.streams[0]?.stops, 0);
    binding.emit(0, path.join(child, "main.ts"), 0x1000);
    assert.deepEqual(events, [["change", "main.ts"]]);
    nested.close();
  };
