import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";
import assert from "node:assert/strict";

import { openFd, readFdText, writeFdText } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_RDWR = 2;

/**
 * Verifies a positioned write whose end no buffer can hold reports `EFBIG`
 * through the callback and changes neither the bytes nor the cursor.
 *
 * A valid safe-integer file length can still exceed the engine's allocatable
 * storage. Node's 64-bit Uint8Array length limit is 2^53 - 1, rather than 2^40;
 * an accepted virtual allocation need not commit all its physical pages.
 * Independently verify native RangeError refusal at the last two safe lengths
 * before asking MemFS to translate that same allocation failure to EFBIG. No
 * oversized accepted buffer is filled or read, and no allocator is patched.
 *
 * 1. Seed `/f.txt`="abcdef" and open it read-write.
 * 2. Independently verify allocation refusal at the last two safe lengths, then
 *    write one byte ending at each of those lengths.
 * 3. Read the file and the cursor, then write inside the file to prove the
 *    descriptor still works.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls host.fs.write at two valid safe-integer ends independently refused by the native allocator and observes the coded callback error and zero byte count, then re-reads the file text and the cursor to prove nothing was mutated.
 * @evidence contracts/testing.md#independent-expectations Native Uint8Array RangeError assertions establish allocation refusal independently of MemFS; the lengths remain within Node's documented 2^53 - 1 limit and positioned-write safe-integer validation. EFBIG, count 0, unchanged "abcdef", and subsequent "Zbcdef" are authored literals.
 * @evidence contracts/testing.md#distinguishing-cases Two oversized positions contrast with the accepted in-bounds write that follows; a position past 2^53 (a distinct EINVAL case) and the beyond-EOF zero-fill of a small gap are owned by test_memfs_write_honors_explicit_positions.
 * @evidence contracts/testing.md#execution-ownership Unit entry that drives native allocation refusal and in-process createMemFS callbacks; no Go runtime or worker is started. The independently checked near-eight-pebibyte requests are refused on the host; no accepted large buffer is touched, no real storage is written, and a surprising native allocation success fails the precondition before MemFS can initialize it.
 */
export const test_memfs_write_reports_efbig_for_an_unallocatable_position =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abcdef");
    const fd = await openFd(host.fs, "/f.txt", O_RDWR);

    const lengths = [Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER];
    for (const length of lengths)
      assert.throws(
        () => new Uint8Array(length),
        RangeError,
        `native allocation must refuse the safe length ${length}`,
      );
    for (const length of lengths)
      TestValidator.equals(
        `a write ending at the independently refused length ${length}`,
        await writeFdText(host.fs, fd, "!", length - 1),
        { code: "EFBIG", n: 0 },
      );
    TestValidator.equals(
      "refused writes keep the bytes",
      host.readFileText("/f.txt"),
      "abcdef",
    );
    TestValidator.equals(
      "refused writes leave the cursor at byte 0",
      await readFdText(host.fs, fd, 3),
      "abc",
    );

    TestValidator.equals(
      "an in-bounds write still succeeds afterwards",
      await writeFdText(host.fs, fd, "Z", 0),
      { code: null, n: 1 },
    );
    TestValidator.equals(
      "the accepted write changed only its byte",
      host.readFileText("/f.txt"),
      "Zbcdef",
    );
  };
