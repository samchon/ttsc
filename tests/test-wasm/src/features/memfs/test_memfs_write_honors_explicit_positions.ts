import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openFd, readFdText, writeFdText } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_RDWR = 2;

/**
 * Verifies a positioned MemFS write overwrites at exactly that offset, extends
 * with zero-fill beyond end-of-file, and never moves the descriptor cursor.
 *
 * The write branch built `existing + incoming` and set the cursor to the new
 * end, so it could only ever append: position 0 appended and every other
 * explicit offset was rejected with `ESPIPE`, including in-bounds ones. Go
 * reaches this path through `syscall.Pwrite`, which a seeked `os.File.Write`
 * uses, so a caller saw `null` and got bytes somewhere it never asked for.
 *
 * 1. Open `abcdef` read-write and write one byte at position 0, then at 2.
 * 2. Write past end-of-file to force a zero-filled gap.
 * 3. Assert each write landed at its offset, the gap is NUL-filled, and a
 *    following cursor read still starts at byte 0.
 */
export const test_memfs_write_honors_explicit_positions =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abcdef");
    const fd = await openFd(host.fs, "/f.txt", O_RDWR);

    const atZero = await writeFdText(host.fs, fd, "Z", 0);
    TestValidator.equals(
      "explicit position 0 overwrites the first byte",
      { ...atZero, text: host.readFileText("/f.txt") },
      { code: null, n: 1, text: "Zbcdef" },
    );

    const inBounds = await writeFdText(host.fs, fd, "YY", 2);
    TestValidator.equals(
      "an in-bounds offset overwrites there",
      { ...inBounds, text: host.readFileText("/f.txt") },
      { code: null, n: 2, text: "ZbYYef" },
    );

    const beyondEof = await writeFdText(host.fs, fd, "!", 8);
    TestValidator.equals(
      "a write past end-of-file zero-fills the gap",
      {
        ...beyondEof,
        bytes: [...(host.readFile("/f.txt") ?? new Uint8Array())],
      },
      {
        code: null,
        n: 1,
        bytes: [0x5a, 0x62, 0x59, 0x59, 0x65, 0x66, 0x00, 0x00, 0x21],
      },
    );

    // Every write above was positioned, so the cursor never moved off byte 0.
    TestValidator.equals(
      "positioned writes leave the cursor alone",
      await readFdText(host.fs, fd, 3),
      "ZbY",
    );
  };
