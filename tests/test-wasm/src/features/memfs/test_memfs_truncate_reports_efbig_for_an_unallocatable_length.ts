import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { callMutation, expectFsError, openFd } from "../../internal/callbackFs";

/**
 * Verifies path and descriptor truncation report a length too large to allocate
 * as `EFBIG` through the callback and leave the file untouched.
 *
 * Independently verify the engine refuses the last safe integer length and
 * the following unsafe integer with RangeError before MemFS translates those
 * same failures. Node's 64-bit typed-array limit permits 2^53 - 1 as a length;
 * that numeric upper bound does not promise allocation succeeds. Truncation
 * accepts both integers, unlike positioned writes' safe-integer end check.
 *
 * 1. Seed `/t.txt`="abcdef" and open it for writing.
 * 2. Verify native allocation refusal, then truncate and ftruncate to those
 *    same 2^53 - 1 and 2^53 lengths.
 * 3. Read the file back, then truncate and ftruncate to a small accepted size.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls host.fs.truncate and host.fs.ftruncate with unallocatable integer lengths and observes the coded callback error, then re-reads the file to prove no resize happened.
 * @evidence contracts/testing.md#independent-expectations Native Uint8Array RangeError assertions establish allocation refusal independently of MemFS, including the permitted numeric length 2^53 - 1 and the larger 2^53 boundary. EFBIG and unchanged "abcdef" are authored expectations; accepted sizes independently yield "abc" and its two zero bytes.
 * @evidence contracts/testing.md#distinguishing-cases Path and descriptor lanes, a safe and an unsafe integer, and the failed sizes contrast with accepted sizes 3 and 5 that succeed and change the bytes.
 * @evidence contracts/testing.md#execution-ownership Unit entry that drives native allocation refusal and in-process createMemFS callbacks; no Go runtime or worker is started. Near-eight-pebibyte native requests must fail before MemFS can initialize any accepted large buffer. Negative, directory and missing-path codes are owned by test_memfs_truncate_resizes_file_and_validates.
 */
export const test_memfs_truncate_reports_efbig_for_an_unallocatable_length =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/t.txt", "abcdef");
    const fd = await openFd(host.fs, "/t.txt", 2);

    for (const length of [Number.MAX_SAFE_INTEGER, 2 ** 53])
      assert.throws(
        () => new Uint8Array(length),
        RangeError,
        `native allocation must refuse the length ${length}`,
      );

    const codes = {
      pathSafe: await expectFsError((cb) =>
        host.fs.truncate("/t.txt", Number.MAX_SAFE_INTEGER, cb),
      ),
      pathUnsafe: await expectFsError((cb) =>
        host.fs.truncate("/t.txt", 2 ** 53, cb),
      ),
      fdSafe: await expectFsError((cb) =>
        host.fs.ftruncate(fd, Number.MAX_SAFE_INTEGER, cb),
      ),
      fdUnsafe: await expectFsError((cb) => host.fs.ftruncate(fd, 2 ** 53, cb)),
    };
    TestValidator.equals("oversized lengths", codes, {
      pathSafe: "EFBIG",
      pathUnsafe: "EFBIG",
      fdSafe: "EFBIG",
      fdUnsafe: "EFBIG",
    });
    TestValidator.equals(
      "a refused resize keeps the bytes",
      host.readFileText("/t.txt"),
      "abcdef",
    );

    await callMutation((cb) => host.fs.truncate("/t.txt", 3, cb));
    TestValidator.equals(
      "accepted path size",
      host.readFileText("/t.txt"),
      "abc",
    );
    await callMutation((cb) => host.fs.ftruncate(fd, 5, cb));
    const grown = host.readFile("/t.txt");
    TestValidator.equals(
      "accepted descriptor size",
      grown === null ? null : [...grown],
      [97, 98, 99, 0, 0],
    );
  };
