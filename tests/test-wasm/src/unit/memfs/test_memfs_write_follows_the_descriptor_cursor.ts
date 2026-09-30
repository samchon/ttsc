import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openFd, readFdText, writeFdText } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_RDWR = 2;
const O_CREAT = 64;
const O_TRUNC = 512;

/**
 * Verifies a MemFS write with `position: null` uses and advances the
 * descriptor's own cursor, and that two descriptors on one file keep separate
 * cursors.
 *
 * Go's `syscall.Write` passes `null` for every unseeked write, so the cursor is
 * the only offset the JavaScript side is given. The old implementation tracked
 * `entry.position` but never read it, appending instead — which happened to
 * match for a freshly truncated output file and silently diverged for every
 * other descriptor.
 *
 * 1. Read two bytes of `abcdef`, then write one byte with `position: null`.
 * 2. Open the same file twice and interleave cursor writes on both descriptors.
 * 3. Assert the write landed at the cursor, the cursor advanced, and neither
 *    descriptor moved the other's offset.
 */
export const test_memfs_write_follows_the_descriptor_cursor =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abcdef");
    const fd = await openFd(host.fs, "/f.txt", O_RDWR);

    TestValidator.equals(
      "reading two bytes advances the cursor",
      await readFdText(host.fs, fd, 2),
      "ab",
    );
    const written = await writeFdText(host.fs, fd, "Q", null);
    TestValidator.equals(
      "a cursor write overwrites at the cursor",
      { ...written, text: host.readFileText("/f.txt") },
      { code: null, n: 1, text: "abQdef" },
    );
    TestValidator.equals(
      "the cursor advanced past the written byte",
      await readFdText(host.fs, fd, 2),
      "de",
    );

    // Two descriptors over shared data keep independent cursors.
    host.writeFile("/shared.txt", "");
    const first = await openFd(host.fs, "/shared.txt", O_WRONLY | O_CREAT);
    const second = await openFd(host.fs, "/shared.txt", O_WRONLY | O_CREAT);
    await writeFdText(host.fs, first, "AAA", null);
    await writeFdText(host.fs, second, "b", null);
    await writeFdText(host.fs, first, "C", null);
    TestValidator.equals(
      "each descriptor writes at its own offset",
      host.readFileText("/shared.txt"),
      "bAAC",
    );

    // The common compiler-output shape stays byte-identical: create, truncate,
    // then write sequentially with a null position.
    host.mkdirp("/out");
    const output = await openFd(
      host.fs,
      "/out/index.js",
      O_WRONLY | O_CREAT | O_TRUNC,
    );
    await writeFdText(host.fs, output, "export const a = 1;\n", null);
    await writeFdText(host.fs, output, "export const b = 2;\n", null);
    TestValidator.equals(
      "sequential output writes concatenate",
      host.readFileText("/out/index.js"),
      "export const a = 1;\nexport const b = 2;\n",
    );
  };
