import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import {
  expectFsError,
  openFd,
  openResult,
  readFdText,
  writeFdText,
} from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_RDWR = 2;
const O_TRUNC = 512;

/**
 * Verifies a MemFS descriptor only permits the operations its `open` access
 * mode granted.
 *
 * The descriptor record stored just a path and an offset, so a read-only
 * descriptor accepted writes and a write-only descriptor accepted reads. Both
 * reported success, which is worse than a refusal: the caller keeps a handle it
 * believes is restricted while the file changes underneath it.
 *
 * 1. Open the same file read-only, write-only, and read-write.
 * 2. Drive a write through the read-only fd and a read through the write-only fd,
 *    then exercise both directions on the read-write fd.
 * 3. Assert the forbidden operations return `EBADF` with zero bytes and no byte
 *    change, and that the permitted ones still work.
 */
export const test_memfs_descriptors_enforce_their_access_mode =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abc");

    const readOnly = await openFd(host.fs, "/f.txt", 0);
    const writeOnly = await openFd(host.fs, "/f.txt", O_WRONLY);
    const readWrite = await openFd(host.fs, "/f.txt", O_RDWR);

    const rejectedWrite = await writeFdText(host.fs, readOnly, "Z", null);
    TestValidator.equals(
      "a read-only descriptor rejects writes",
      { ...rejectedWrite, text: host.readFileText("/f.txt") },
      { code: "EBADF", n: 0, text: "abc" },
    );
    TestValidator.equals(
      "a write-only descriptor rejects reads",
      await expectFsError((cb) =>
        host.fs.read(writeOnly, new Uint8Array(1), 0, 1, null, cb),
      ),
      "EBADF",
    );

    // Positive twins: the granted directions still work.
    TestValidator.equals(
      "a read-only descriptor still reads",
      await readFdText(host.fs, readOnly, 3),
      "abc",
    );
    const allowedWrite = await writeFdText(host.fs, readWrite, "X", 0);
    TestValidator.equals(
      "a read-write descriptor reads and writes",
      {
        ...allowedWrite,
        text: host.readFileText("/f.txt"),
        read: await readFdText(host.fs, readWrite, 3),
      },
      { code: null, n: 1, text: "Xbc", read: "Xbc" },
    );

    // A directory opens read-only only; a write mode would replace it.
    host.mkdirp("/dir");
    TestValidator.equals(
      "a directory refuses a write access mode",
      {
        writeOnly: await openResult(host.fs, "/dir", O_WRONLY),
        readWrite: await openResult(host.fs, "/dir", O_RDWR),
        truncate: await openResult(host.fs, "/dir", O_TRUNC),
      },
      {
        writeOnly: { code: "EISDIR", fd: -1 },
        readWrite: { code: "EISDIR", fd: -1 },
        truncate: { code: "EISDIR", fd: -1 },
      },
    );
  };
