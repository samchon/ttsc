import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { expectFsError, readdir } from "../../internal/callbackFs";

/**
 * Verifies MemFS keeps refusing links and reading link targets.
 *
 * Symlinks and hardlinks are intentionally unsupported: the node map is a plain
 * path-to-node tree with no indirection, so a link that appeared to succeed
 * would produce exactly the incoherent state the tree invariant exists to
 * prevent. Tightening the writer and descriptor paths must not accidentally
 * turn any of these into a success, and none of them had a case before.
 *
 * 1. Seed a file and a directory.
 * 2. Call `link`, `symlink`, and `readlink` against them.
 * 3. Assert `EPERM`, `EPERM`, and `EINVAL`, and that no node was created.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs refuses link, symlink and readlink without adding namespace nodes. Exact errors and root children detect a false success or a partial unsupported link creation.
 * @evidence contracts/testing.md#independent-expectations MemFS deliberately has no link indirection: link/symlink return EPERM and reading an ordinary file as a link returns EINVAL. Literal root entries dir and f.txt are the independent seeded tree.
 * @evidence contracts/testing.md#distinguishing-cases File hardlink, directory hardlink, file symlink and ordinary-file readlink each retain their error identity. Supported ordinary file and directory seeding supplies the unchanged namespace baseline.
 * @evidence contracts/testing.md#execution-ownership test_memfs_link_operations_stay_unsupported calls createMemFS, invokes fs.link/symlink/readlink through expectFsError, and observes fs.readdir through readdir. All four operations execute in memory in the source-unit process.
 */
export const test_memfs_link_operations_stay_unsupported =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "abc");
    host.mkdirp("/dir");

    const codes = {
      link: await expectFsError((cb) => host.fs.link("/f.txt", "/hard", cb)),
      linkDirectory: await expectFsError((cb) =>
        host.fs.link("/dir", "/hard-dir", cb),
      ),
      symlink: await expectFsError((cb) =>
        host.fs.symlink("/f.txt", "/soft", cb),
      ),
      readlink: await expectFsError((cb) => host.fs.readlink("/f.txt", cb)),
    };
    TestValidator.equals("rejection codes", codes, {
      link: "EPERM",
      linkDirectory: "EPERM",
      symlink: "EPERM",
      readlink: "EINVAL",
    });

    TestValidator.equals(
      "no link node was created",
      await readdir(host.fs, "/"),
      ["dir", "f.txt"],
    );
  };
