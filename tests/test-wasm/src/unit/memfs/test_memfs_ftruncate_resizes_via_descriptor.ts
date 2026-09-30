import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, expectFsError, openFd } from "../../internal/callbackFs";

/**
 * Verifies MemFS ftruncate resizes the file behind a valid descriptor and
 * rejects inappropriate descriptors.
 *
 * `ftruncate` must apply the same byte rules as path `truncate` but through the
 * descriptor table, and it must refuse descriptors that have no truncatable
 * file: the reserved stdout/stderr fds and unknown fds. The pre-fix version was
 * a no-op, so a descriptor-based truncate left the file unchanged.
 *
 * 1. Seed `/t.txt`="abcdef", then shrink its descriptor to 3 and grow it to 5.
 * 2. Read the bytes and reject unknown, stdout, and negative-length calls.
 * 3. Assert shrink, zero-filled growth, and each rejection code.
 */
export const test_memfs_ftruncate_resizes_via_descriptor =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/t.txt", "abcdef");
    const fd = await openFd(host.fs, "/t.txt", 2);

    await callMutation((cb) => host.fs.ftruncate(fd, 3, cb));
    TestValidator.equals(
      "descriptor truncate shrinks the file",
      host.readFileText("/t.txt"),
      "abc",
    );
    await callMutation((cb) => host.fs.ftruncate(fd, 5, cb));
    const grown = host.readFile("/t.txt");
    TestValidator.equals(
      "descriptor truncate zero-extends the file",
      grown === null ? null : [...grown],
      [97, 98, 99, 0, 0],
    );

    const codes = {
      unknownFd: await expectFsError((cb) => host.fs.ftruncate(987654, 0, cb)),
      stdout: await expectFsError((cb) => host.fs.ftruncate(1, 0, cb)),
      negative: await expectFsError((cb) => host.fs.ftruncate(fd, -1, cb)),
    };
    TestValidator.equals("rejection codes", codes, {
      unknownFd: "EBADF",
      stdout: "EINVAL",
      negative: "EINVAL",
    });
  };
