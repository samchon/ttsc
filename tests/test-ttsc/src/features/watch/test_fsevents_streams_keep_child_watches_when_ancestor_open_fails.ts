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
 *
 * @evidence contracts/testing.md#behavioral-verification FseventsStreams.open propagates an injected ancestor watch failure while leaving the original child stream open and delivering the exact child change event.
 * @evidence contracts/testing.md#independent-expectations The open-before-retire contract requires the original subscription to survive failed replacement. The literal error, one recorded stream, zero stops and change/main.ts are independent observations.
 * @evidence contracts/testing.md#distinguishing-cases An existing child is the positive control; beforeOpen rejects only its ancestor, and subsequent child delivery distinguishes intact ownership from a throw after destructive transfer. Successful promotion is covered by recheck_a_child_when_an_ancestor_takes_over.
 * @evidence contracts/testing.md#execution-ownership This exported source unit invokes open through the supported fake binding constructor seam; beforeOpen throws synchronously and emit invokes the captured callback. No native binding load, process or filesystem observation runs.
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
