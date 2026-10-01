import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import {
  callMutation,
  openFd,
  readFdText,
  writeFdText,
} from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_RDWR = 2;
const O_APPEND = 1024;

/**
 * Verifies a MemFS descriptor keeps its cursor and flags across `ftruncate` and
 * a rename that moves the file underneath it.
 *
 * `rename` already re-points open descriptors at the moved path and `ftruncate`
 * already resizes through one, but neither ever met a write that consults the
 * cursor. A descriptor left pointing past a shrunken end-of-file must zero-fill
 * the gap on the next sequential write instead of silently relocating it, and a
 * moved descriptor must apply its retained append flag to the node at its new
 * path.
 *
 * 1. Read four bytes, shrink the file to one with `ftruncate`, then write at the
 *    cursor.
 * 2. Rename the file and write again through the same descriptor.
 * 3. Assert the gap was zero-filled, the write followed the rename, and an
 *    `O_APPEND` descriptor still appends after its file moves.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS retains descriptor cursor and append flag across ftruncate and rename. Zero-byte write must not grow a shrunken file; a later cursor write zero-fills the gap and subsequent writes target the moved node.
 * @evidence contracts/testing.md#independent-expectations Resizing changes file size rather than the descriptor offset, and rename preserves an open node. The literal byte sequence a,NUL,NUL,NUL,Z,! and appended LM follow authored read lengths and writes independently of the implementation.
 * @evidence contracts/testing.md#distinguishing-cases The cursor lies past EOF after shrink; empty write and nonempty write distinguish no-op from sparse growth. Ordinary cursor continuation and an O_APPEND descriptor after rename cover both retained flags.
 * @evidence contracts/testing.md#execution-ownership test_memfs_descriptor_state_survives_ftruncate_and_rename calls createMemFS, openFd/readFdText/writeFdText and callMutation for ftruncate/rename directly. It owns the exact byte and old-path checks inside the source-unit process without a Wasm producer.
 */
export const test_memfs_descriptor_state_survives_ftruncate_and_rename =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abcdef");
    const fd = await openFd(host.fs, "/f.txt", O_RDWR);

    TestValidator.equals(
      "reading four bytes leaves the cursor at 4",
      await readFdText(host.fs, fd, 4),
      "abcd",
    );
    await callMutation((cb) => host.fs.ftruncate(fd, 1, cb));

    // Boundary: writing nothing from a cursor past end-of-file must not
    // resize the file up to that cursor.
    const empty = await writeFdText(host.fs, fd, "", null);
    TestValidator.equals(
      "a zero-byte write changes nothing",
      { ...empty, text: host.readFileText("/f.txt") },
      { code: null, n: 0, text: "a" },
    );

    const afterTruncate = await writeFdText(host.fs, fd, "Z", null);
    TestValidator.equals(
      "a cursor beyond end-of-file zero-fills the gap",
      {
        ...afterTruncate,
        bytes: [...(host.readFile("/f.txt") ?? new Uint8Array())],
      },
      { code: null, n: 1, bytes: [0x61, 0x00, 0x00, 0x00, 0x5a] },
    );

    await callMutation((cb) => host.fs.rename("/f.txt", "/moved.txt", cb));
    const afterRename = await writeFdText(host.fs, fd, "!", null);
    TestValidator.equals(
      "the descriptor writes into the renamed file",
      {
        ...afterRename,
        bytes: [...(host.readFile("/moved.txt") ?? new Uint8Array())],
        original: host.exists("/f.txt"),
      },
      {
        code: null,
        n: 1,
        bytes: [0x61, 0x00, 0x00, 0x00, 0x5a, 0x21],
        original: false,
      },
    );

    // A retained O_APPEND flag applies to the node at the descriptor's new path.
    host.writeFile("/log.txt", "L");
    const appendFd = await openFd(host.fs, "/log.txt", O_WRONLY | O_APPEND);
    await callMutation((cb) => host.fs.rename("/log.txt", "/renamed.txt", cb));
    await writeFdText(host.fs, appendFd, "M", null);
    TestValidator.equals(
      "append still appends after the rename",
      host.readFileText("/renamed.txt"),
      "LM",
    );
  };
