import assert from "node:assert/strict";
import fs from "node:fs";

import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";

/**
 * Verifies the directory adapter owns one supplied subscription and preserves its lifecycle.
 *
 * The directory adapter must forward its arguments and events through the supplied
 * watch function, normalize names and gaps, and hand back that subscription's own
 * handle, without replacing the global filesystem watch.
 *
 * 1. Open a recursive and a non-recursive adapter through an injected watch
 *    function and require one call with the persistent option.
 * 2. Deliver change, rename, unrecognized and nameless events and require
 *    normalized names, a rename for the unrecognized kind and a gap flag only for
 *    the nameless event.
 * 3. Close the handle and require one close and the original fs.watch untouched.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored adapter forwards location and recursion to one observer, normalizes events and absent filenames, and returns the same closable handle without replacing the global filesystem operation.
 * @evidence contracts/testing.md#independent-expectations Literal subscription options and event tuples establish the expected protocol independently of the adapter; the fixture retains the callback and a distinct handle identity.
 * @evidence contracts/testing.md#distinguishing-cases Change, rename, unknown events, Buffer filenames and a null observation gap distinguish normalization; recursive false and true distinguish options, and closing the returned handle establishes lifecycle authority.
 * @evidence contracts/testing.md#execution-ownership The named src/features/watch entry calls the authored source adapter with an explicitly owned observer and invokes its actual callback; no compiler, host, binary build or native scheduler runs.
 */
export function test_watch_directory_adapter_maps_owned_subscriptions_without_replacing_fs() {
  const nativeWatch = fs.watch;
  for (const recursive of [false, true]) {
    let calls = 0;
    let closed = 0;
    let callback: ((event: string, filename: string | Buffer | null) => void) | undefined;
    const handle = { close() { closed += 1; } };
    const events: Array<[string, string | null, boolean | undefined]> = [];
    const openWatch = ((location: string, options: unknown, listener: typeof callback) => {
      calls += 1;
      assert.equal(location, "owned-directory");
      assert.deepEqual(options, { persistent: true, recursive });
      callback = listener;
      return handle;
    }) as typeof fs.watch;
    const actual = watchDirectoryThroughFsWatch("owned-directory", recursive, (event, filename, gap) => events.push([event, filename, gap]), openWatch);
    assert.equal(actual, handle);
    assert.equal(calls, 1);
    assert.ok(callback);
    callback("change", "file.ts");
    callback("rename", Buffer.from("entry.ts"));
    callback("unrecognized", "other.ts");
    callback("change", null);
    assert.deepEqual(events, [["change", "file.ts", false], ["rename", "entry.ts", false], ["rename", "other.ts", false], ["change", null, true]]);
    actual.close();
    assert.equal(closed, 1);
    assert.equal(fs.watch, nativeWatch);
  }
}
