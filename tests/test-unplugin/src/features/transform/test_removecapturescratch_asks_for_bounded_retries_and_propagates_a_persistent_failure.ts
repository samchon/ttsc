import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { removeCaptureScratch } from "../../../../../packages/unplugin/src/core/transform/generation/removeCaptureScratch";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the capture scratch removal asks the filesystem for a bounded retry,
 * removes a real tree, and lets a failure that outlasts the retries reach the
 * caller.
 *
 * Windows refuses to remove a directory a process still holds, and only the
 * asynchronous `fs.promises.rm` retries (`rmSync` ignores `maxRetries`). The
 * removal therefore passes ten retries 100 ms apart and does not swallow a
 * failure that persists, because the capture decides whether a cleanup error may
 * replace its own.
 *
 * 1. Remove a real directory tree and a directory that does not exist.
 * 2. Remove through an injected operation and read the directory and options it
 *    received.
 * 3. Remove through an injected operation that always rejects with `EBUSY` and
 *    require the very same error to reject the call.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls removeCaptureScratch with the native operation on a real tree and a missing directory, and with injected operations that resolve and reject, so a skipped removal, a lost option and a swallowed failure each fail an assertion.
 * @evidence contracts/testing.md#independent-expectations The expected options object `{ force: true, maxRetries: 10, recursive: true, retryDelay: 100 }` is the documented retry policy written as a literal, and `EBUSY` is the error Windows reports for a held directory; neither is read back from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases A real removal and a missing directory (which `force` must accept) contrast with a persistent `EBUSY` that must reject the same error object, and a resolving injected operation contrasts with the rejecting one.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored removal over a real temporary tree and injected operations in process. Node's own retry cannot be observed from an injected operation, so a transient hold that clears is not exercised here; the injected case asserts the request for retries, not the retry itself, and a real held directory needs the Windows capture path.
 */
export async function test_removecapturescratch_asks_for_bounded_retries_and_propagates_a_persistent_failure(): Promise<void> {
  const base = TestProject.tmpdir("ttsc-capture-scratch-unit-");
  try {
    const tree = path.join(base, "scratch");
    TestProject.writeFiles(tree, {
      "a.txt": "a",
      "nested/deep/b.txt": "b",
    });
    await removeCaptureScratch(tree);
    assert.equal(fs.existsSync(tree), false, "a real scratch tree is removed");
    await removeCaptureScratch(path.join(base, "missing"));

    const calls: { directory: string; options: unknown }[] = [];
    const remove = (async (directory: string, options: unknown) => {
      calls.push({ directory, options });
    }) as typeof fs.promises.rm;
    await removeCaptureScratch("/scratch/dir", remove);
    assert.deepEqual(calls, [
      {
        directory: "/scratch/dir",
        options: {
          force: true,
          maxRetries: 10,
          recursive: true,
          retryDelay: 100,
        },
      },
    ]);

    const busy = Object.assign(new Error("EBUSY: resource busy or locked"), {
      code: "EBUSY",
    });
    const failing = (async () => {
      throw busy;
    }) as typeof fs.promises.rm;
    await assert.rejects(
      () => removeCaptureScratch("/scratch/dir", failing),
      (error: unknown) => error === busy,
    );
  } finally {
    fs.rmSync(base, { force: true, recursive: true });
  }
}
