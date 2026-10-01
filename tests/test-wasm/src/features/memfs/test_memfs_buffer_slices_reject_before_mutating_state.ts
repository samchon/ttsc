import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openFd, readFdText } from "../../internal/callbackFs";

/**
 * Verifies malformed buffer slices cannot consume input or mutate output.
 *
 * A rejected runtime transfer must leave the next valid transfer usable;
 * silently clipping a slice corrupts file cursors and pipe messages.
 *
 * 1. Reject negative, fractional, nonfinite, overflowing and out-of-range slices.
 * 2. Check file bytes, read buffers, descriptor cursors and stdout stay intact.
 * 3. Transfer a valid interior slice and a zero-length end slice, then verify
 *    invalid pipe transfers leave the queued message intact.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createMemFS callback read/write reject malformed offset/length with EINVAL and zero transferred bytes before changing file bytes, descriptor cursors, output capture or queued virtual pipe bytes. Valid interior and end-boundary slices remain usable.
 * @evidence contracts/testing.md#independent-expectations Authored abcdef, sentinel byte 63 and input !XY? give independently specified abcdef, aXYdef and [63,97,88,63] readback. EINVAL/zero are the declared invalid-transfer contract, not values derived from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Negative, fractional, NaN, infinite, unsafe-integer, beyond-buffer and overflowing-end slices distinguish rejection from JavaScript subarray clipping. File cursor, stdout and queued virtual pipe cases exercise distinct state owners; valid offset one and offset-at-end zero-length are positive boundaries.
 * @evidence contracts/testing.md#execution-ownership test_memfs_buffer_slices_reject_before_mutating_state owns all populations by calling the actual source createMemFS bridge in one Node process. openFd/readFdText only adapt callbacks; the local transfer adapter reports actual error codes/counts. pipe2 is the virtual JavaScript bridge, with no native pipe or Wasm compiler execution.
 */
export const test_memfs_buffer_slices_reject_before_mutating_state =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/file", "abcdef");
    const fd = await openFd(host.fs, "/file", 2);
    const transfer = (
      operation: "read" | "write",
      descriptor: number,
      bytes: Uint8Array,
      offset: number,
      length: number,
    ): Promise<{ code: string | null; n: number }> =>
      new Promise((resolve) => {
        host.fs[operation](descriptor, bytes, offset, length, null, (err, n) =>
          resolve({ code: err?.code ?? null, n }),
        );
      });
    const invalid: [number, number][] = [
      [-1, 1],
      [0, -1],
      [0.5, 1],
      [0, 0.5],
      [NaN, 1],
      [0, Infinity],
      [Number.MAX_SAFE_INTEGER + 1, 0],
      [5, 0],
      [3, 2],
    ];
    for (const [offset, length] of invalid) {
      const bytes = new Uint8Array([63, 63, 63, 63]);
      for (const operation of ["read", "write"] as const)
        TestValidator.equals(
          `${operation} rejects ${offset}/${length}`,
          await transfer(operation, fd, bytes, offset, length),
          { code: "EINVAL", n: 0 },
        );
      TestValidator.equals(
        "rejected read leaves destination intact",
        [...bytes],
        [63, 63, 63, 63],
      );
      TestValidator.equals(
        "rejected stdout write transfers nothing",
        await transfer("write", 1, bytes, offset, length),
        { code: "EINVAL", n: 0 },
      );
    }
    TestValidator.equals(
      "rejected writes preserve file",
      host.readFileText("/file"),
      "abcdef",
    );
    TestValidator.equals(
      "rejected writes preserve stdout",
      host.stdout.buffer,
      "",
    );
    TestValidator.equals(
      "rejected transfers preserve cursor",
      await readFdText(host.fs, fd, 1),
      "a",
    );
    TestValidator.equals(
      "interior write copies only requested bytes",
      await transfer("write", fd, new Uint8Array([33, 88, 89, 63]), 1, 2),
      { code: null, n: 2 },
    );
    TestValidator.equals(
      "interior write lands at retained cursor",
      host.readFileText("/file"),
      "aXYdef",
    );
    const reader = await openFd(host.fs, "/file", 0);
    const destination = new Uint8Array([63, 63, 63, 63]);
    TestValidator.equals(
      "interior read count",
      await transfer("read", reader, destination, 1, 2),
      { code: null, n: 2 },
    );
    TestValidator.equals(
      "interior read preserves sentinel edges",
      [...destination],
      [63, 97, 88, 63],
    );
    for (const operation of ["read", "write"] as const)
      TestValidator.equals(
        "end-boundary empty slice",
        await transfer(operation, fd, destination, 4, 0),
        { code: null, n: 0 },
      );
    TestValidator.equals(
      "empty slice preserves cursor",
      await readFdText(host.fs, fd, 1),
      "d",
    );

    const [pipeRead, pipeWrite] = await new Promise<number[]>((resolve, reject) =>
      host.fs.pipe2(0, (err, fds) => (err ? reject(err) : resolve(fds))),
    );
    TestValidator.equals(
      "queue authored pipe bytes",
      await transfer("write", pipeWrite!, new Uint8Array([80, 81]), 0, 2),
      { code: null, n: 2 },
    );
    TestValidator.equals(
      "invalid pipe read consumes nothing",
      await transfer("read", pipeRead!, destination, 3, 2),
      { code: "EINVAL", n: 0 },
    );
    TestValidator.equals(
      "invalid pipe write queues nothing",
      await transfer("write", pipeWrite!, destination, 3, 2),
      { code: "EINVAL", n: 0 },
    );
    TestValidator.equals(
      "queued message survives rejection",
      await readFdText(host.fs, pipeRead!, 2),
      "PQ",
    );
    await new Promise<void>((resolve, reject) =>
      host.fs.close(pipeWrite!, (err) => (err ? reject(err) : resolve())),
    );
    TestValidator.equals(
      "rejected pipe write leaves no extra queued bytes",
      await readFdText(host.fs, pipeRead!, 4),
      "",
    );
  };
