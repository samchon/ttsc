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
 * 1. Open `abcdef` read-write and write one byte at position 0, then two at 2.
 * 2. Write past end-of-file to force a zero-filled gap.
 * 3. Assert each write landed at its offset, the gap is NUL-filled, and a
 *    following cursor read still starts at byte 0.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.write honors explicit offsets, zero-fills a beyond-EOF gap and leaves the sequential cursor unchanged. Exact byte arrays detect append substitution, ESPIPE on files or accidental cursor advancement.
 * @evidence contracts/testing.md#independent-expectations Positioned writes alter the requested file range without seeking the descriptor. Authored Z at zero, YY at two and ! at eight independently yield the bytes ZbYYef, two NUL bytes and !, with a next cursor read ZbY.
 * @evidence contracts/testing.md#distinguishing-cases Zero offset, interior offset and beyond-EOF offset cover overwrite and sparse growth; negative, fractional, NaN, infinite, unsafe and overflow-end offsets reject with EINVAL without changing bytes or cursor. The final null-position read checks the cursor boundary. Append-specific offset override is owned by the append sibling.
 * @evidence contracts/testing.md#execution-ownership test_memfs_write_honors_explicit_positions runs createMemFS.fs.open/read/write through the callbackFs adapters and compares code/count, complete bytes and cursor read. This source-unit entry executes no real filesystem or Go host.
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

    for (const position of [-1, 0.5, NaN, Infinity, 2 ** 53, Number.MAX_SAFE_INTEGER])
      TestValidator.equals(
        `invalid positioned write ${position}`,
        await writeFdText(host.fs, fd, "!", position),
        { code: "EINVAL", n: 0 },
      );
    TestValidator.equals(
      "invalid positions preserve file bytes",
      [...host.readFile("/f.txt")!],
      [0x5a, 0x62, 0x59, 0x59, 0x65, 0x66, 0x00, 0x00, 0x21],
    );
    // Every write above was positioned or rejected, so the cursor never moved.
    TestValidator.equals(
      "positioned writes leave the cursor alone",
      await readFdText(host.fs, fd, 3),
      "ZbY",
    );
  };
