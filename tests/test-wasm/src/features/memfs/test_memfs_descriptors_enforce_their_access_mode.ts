import { TestValidator } from "@nestia/e2e";
import { type IWasmExecFS, createMemFS } from "@ttsc/wasm";

import {
  callMutation,
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

function fstatMtime(fs: IWasmExecFS, fd: number): Promise<number> {
  return new Promise<number>((resolve, reject) =>
    fs.fstat(fd, (err, stats) => (err ? reject(err) : resolve(stats.mtimeMs))),
  );
}

/**
 * Verifies a MemFS descriptor only permits the operations its `open` access
 * mode granted.
 *
 * The descriptor record stored just a path and an offset, so a read-only
 * descriptor accepted writes and a write-only descriptor accepted reads. A
 * later gap also let read-only descriptors truncate the file. These operations
 * must fail before changing bytes, mtime, or the shared cursor.
 *
 * 1. Open the same file read-only, write-only, and read-write.
 * 2. Reject read-only write and truncate plus write-only read operations.
 * 3. Assert `EBADF`, unchanged bytes, mtime, and cursor, plus permitted mutations.
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
      "the read-only descriptor advances before rejected ftruncate",
      await readFdText(host.fs, readOnly, 1),
      "a",
    );
    const readOnlyMtime = await fstatMtime(host.fs, readOnly);
    while (Date.now() <= readOnlyMtime)
      await new Promise((resolve) => setTimeout(resolve, 1));
    TestValidator.equals(
      "a read-only descriptor rejects ftruncate without moving its cursor",
      {
        beforeMtime: readOnlyMtime,
        code: await expectFsError((cb) => host.fs.ftruncate(readOnly, 1, cb)),
        afterMtime: await fstatMtime(host.fs, readOnly),
        text: host.readFileText("/f.txt"),
      },
      {
        beforeMtime: readOnlyMtime,
        code: "EBADF",
        afterMtime: readOnlyMtime,
        text: "abc",
      },
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
      "a rejected ftruncate leaves the read-only cursor unchanged",
      await readFdText(host.fs, readOnly, 2),
      "bc",
    );
    const allowedWrite = await writeFdText(host.fs, readWrite, "X", 0);
    await callMutation((cb) => host.fs.ftruncate(writeOnly, 2, cb));
    TestValidator.equals(
      "writable descriptors still write and truncate",
      {
        ...allowedWrite,
        text: host.readFileText("/f.txt"),
        read: await readFdText(host.fs, readWrite, 3),
      },
      { code: null, n: 1, text: "Xb", read: "Xb" },
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
