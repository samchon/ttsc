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
 * 1. Seed `/t.txt`="abcdef" and open it, then ftruncate the descriptor to 3.
 * 2. Read the file back and attempt ftruncate on an unknown fd, the stdout fd, and
 *    a negative length.
 * 3. Assert the file shrank to "abc" and each invalid call carries its code.
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
