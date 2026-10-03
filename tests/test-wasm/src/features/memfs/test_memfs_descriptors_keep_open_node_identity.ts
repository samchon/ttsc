import { TestValidator } from "@nestia/e2e";
import { type IWasmExecFS, createMemFS } from "@ttsc/wasm";

import {
  callMutation,
  expectFsError,
  openFd,
  writeFdText,
} from "../../internal/callbackFs";

const O_RDWR = 2;

function readAt(fs: IWasmExecFS, fd: number, length: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const buffer = new Uint8Array(length);
    fs.read(fd, buffer, 0, length, 0, (err, n) =>
      err
        ? reject(err)
        : resolve(new TextDecoder().decode(buffer.subarray(0, n))),
    );
  });
}

function fstatSize(fs: IWasmExecFS, fd: number): Promise<number> {
  return new Promise<number>((resolve, reject) =>
    fs.fstat(fd, (err, stats) => (err ? reject(err) : resolve(stats.size))),
  );
}

/**
 * Verifies MemFS: open descriptors retain identity across namespace changes.
 *
 * Path-only descriptors either disappeared after unlink or retargeted to a
 * replacement rename destination. Each fd must retain its opened node while the
 * namespace independently removes or replaces names.
 *
 * 1. Unlink an open file, reject path stat, then use every fd operation.
 * 2. Rename one open file over another open file.
 * 3. Mutate both fds, assert distinct bytes, then close without recreating names.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS descriptors continue reading, writing, truncating and statting the opened node after unlink or replacement rename. Literal separated source/destination bytes detect path-based retargeting or recreation on close.
 * @evidence contracts/testing.md#independent-expectations POSIX open-node identity survives namespace removal/replacement. Authored KEEP, NEW and OLD become literal XE, SEW and DLD under independently specified writes; missing path stat must be ENOENT while descriptor size remains two.
 * @evidence contracts/testing.md#distinguishing-cases Unlink with an open fd, file-over-file rename with both fds open, independent writes to displaced and named nodes, and closing the displaced fd cover identity and namespace boundaries.
 * @evidence contracts/testing.md#execution-ownership test_memfs_descriptors_keep_open_node_identity creates MemFS and invokes unlink/rename/ftruncate/close via callMutation, readAt/fstatSize directly wrap fs.read/fstat, and writeFdText wraps fs.write. The one unit entry owns every observed node/namespace result in Node.
 */
export const test_memfs_descriptors_keep_open_node_identity =
  async (): Promise<void> => {
    const host = createMemFS();

    host.writeFile("/unlinked.txt", "KEEP");
    const unlinkedFd = await openFd(host.fs, "/unlinked.txt", O_RDWR);
    await callMutation((cb) => host.fs.unlink("/unlinked.txt", cb));
    await writeFdText(host.fs, unlinkedFd, "X", 0);
    await callMutation((cb) => host.fs.ftruncate(unlinkedFd, 2, cb));
    TestValidator.equals(
      "unlink removes only the name",
      {
        pathExists: host.exists("/unlinked.txt"),
        pathStat: await expectFsError((cb) =>
          host.fs.stat("/unlinked.txt", cb),
        ),
        fdText: await readAt(host.fs, unlinkedFd, 4),
        fdSize: await fstatSize(host.fs, unlinkedFd),
      },
      { pathExists: false, pathStat: "ENOENT", fdText: "XE", fdSize: 2 },
    );

    host.writeFile("/source.txt", "NEW");
    host.writeFile("/destination.txt", "OLD");
    const sourceFd = await openFd(host.fs, "/source.txt", O_RDWR);
    const destinationFd = await openFd(host.fs, "/destination.txt", O_RDWR);
    await callMutation((cb) =>
      host.fs.rename("/source.txt", "/destination.txt", cb),
    );

    TestValidator.equals(
      "replacement rename keeps both opened nodes distinct",
      {
        source: await readAt(host.fs, sourceFd, 3),
        destination: await readAt(host.fs, destinationFd, 3),
      },
      { source: "NEW", destination: "OLD" },
    );

    await writeFdText(host.fs, sourceFd, "S", 0);
    await writeFdText(host.fs, destinationFd, "D", 0);
    TestValidator.equals(
      "writes through either descriptor do not cross over",
      {
        named: host.readFileText("/destination.txt"),
        displaced: await readAt(host.fs, destinationFd, 3),
      },
      { named: "SEW", displaced: "DLD" },
    );

    await callMutation((cb) => host.fs.close(destinationFd, cb));
    TestValidator.equals(
      "closing the displaced descriptor does not recreate a name",
      {
        source: host.exists("/source.txt"),
        destination: host.readFileText("/destination.txt"),
      },
      { source: false, destination: "SEW" },
    );
  };
