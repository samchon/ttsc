import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openFd, readFdText, writeFdText } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_RDWR = 2;

/**
 * Verifies a positioned write whose end no buffer can hold reports `EFBIG`
 * through the callback and changes neither the bytes nor the cursor.
 *
 * Growing the file allocates zero-filled storage up to the write's end, and the
 * engine refuses a size it cannot allocate with a `RangeError` that carries no
 * POSIX code. The virtual filesystem treats that refusal as its maximum file
 * size, so a write at 2^40 must answer with a coded error while the file keeps
 * its bytes, and a following small write must still succeed.
 *
 * 1. Seed `/f.txt`="abcdef" and open it read-write.
 * 2. Write one byte at position 2^40 and at the cursor-independent position
 *    2^40 + 1.
 * 3. Read the file and the cursor, then write inside the file to prove the
 *    descriptor still works.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls host.fs.write at positions far beyond any allocatable size and observes the coded callback error and zero byte count, then re-reads the file text and the cursor to prove nothing was mutated.
 * @evidence contracts/testing.md#independent-expectations The expected code EFBIG, the count 0 and the unchanged text "abcdef" are authored literals; a one-tebibyte zero-filled gap exceeds what the engine allocates regardless of the implementation, and the follow-up write at position 0 independently yields "Zbcdef".
 * @evidence contracts/testing.md#distinguishing-cases Two oversized positions contrast with the accepted in-bounds write that follows; a position past 2^53 (a distinct EINVAL case) and the beyond-EOF zero-fill of a small gap are owned by test_memfs_write_honors_explicit_positions.
 * @evidence contracts/testing.md#execution-ownership Unit entry that drives only the in-process createMemFS filesystem callbacks; no Go runtime or worker is started. The oversized allocation is refused by the host engine before any memory is committed, so the case needs no real storage.
 */
export const test_memfs_write_reports_efbig_for_an_unallocatable_position =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abcdef");
    const fd = await openFd(host.fs, "/f.txt", O_RDWR);

    TestValidator.equals(
      "a write at 2^40 is refused",
      await writeFdText(host.fs, fd, "!", 2 ** 40),
      { code: "EFBIG", n: 0 },
    );
    TestValidator.equals(
      "a write at 2^40 + 1 is refused",
      await writeFdText(host.fs, fd, "!", 2 ** 40 + 1),
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
