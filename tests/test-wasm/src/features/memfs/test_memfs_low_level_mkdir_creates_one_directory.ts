import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import {
  callMutation,
  expectFsError,
  readdir,
} from "../../internal/callbackFs";

/**
 * Verifies MemFS: low-level mkdir creates exactly one directory.
 *
 * Delegating the callback API to `mkdirp` created missing ancestors and treated
 * existing targets as success. The low-level operation must reject before any
 * mutation while the host convenience helper stays recursive and idempotent.
 *
 * 1. Create normalized children beneath an existing parent.
 * 2. Attempt missing-parent, file-parent, existing-target, and root cases.
 * 3. Assert exact error codes, atomic state, and unchanged `mkdirp` behavior.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.mkdir creates one normalized child, rejects invalid parents and existing targets atomically, while host.mkdirp remains recursive/idempotent. Sorted children and literal errors reject accidental recursive low-level creation.
 * @evidence contracts/testing.md#independent-expectations The low-level mkdir contract requires an existing directory parent and an absent target. Independent ENOENT/ENOTDIR/EEXIST codes and seeded FILE bytes establish failures; child and alias names follow authored path normalization.
 * @evidence contracts/testing.md#distinguishing-cases Normal and dot/dot-dot alias children succeed; missing/file parents, existing file/directory, normalized existing target and root reject. Repeated deep mkdirp is the distinct convenience-operation positive control.
 * @evidence contracts/testing.md#execution-ownership test_memfs_low_level_mkdir_creates_one_directory directly runs fs.mkdir with callMutation/expectFsError and host.mkdirp, then readdir/readFileText/exists. The entry owns every named code and tree expectation without external filesystem setup.
 */
export const test_memfs_low_level_mkdir_creates_one_directory =
  async (): Promise<void> => {
    const host = createMemFS();
    host.mkdirp("/parent");
    host.writeFile("/file", "FILE");

    await callMutation((cb) => host.fs.mkdir("/parent/child", 0o755, cb));
    await callMutation((cb) =>
      host.fs.mkdir("/parent/./nested/../alias", 0o755, cb),
    );

    TestValidator.equals(
      "mkdir creates exactly one normalized child",
      await readdir(host.fs, "/parent"),
      ["alias", "child"],
    );

    const codes = {
      missingParent: await expectFsError((cb) =>
        host.fs.mkdir("/missing/child", 0o755, cb),
      ),
      fileParent: await expectFsError((cb) =>
        host.fs.mkdir("/file/child", 0o755, cb),
      ),
      existingFile: await expectFsError((cb) =>
        host.fs.mkdir("/file", 0o755, cb),
      ),
      existingDirectory: await expectFsError((cb) =>
        host.fs.mkdir("/parent", 0o755, cb),
      ),
      normalizedExisting: await expectFsError((cb) =>
        host.fs.mkdir("/parent/x/../child", 0o755, cb),
      ),
      root: await expectFsError((cb) => host.fs.mkdir("/", 0o755, cb)),
    };
    TestValidator.equals("mkdir rejection codes", codes, {
      missingParent: "ENOENT",
      fileParent: "ENOTDIR",
      existingFile: "EEXIST",
      existingDirectory: "EEXIST",
      normalizedExisting: "EEXIST",
      root: "EEXIST",
    });
    TestValidator.equals(
      "rejected mkdir never creates a missing ancestor",
      {
        missing: host.exists("/missing"),
        child: host.exists("/missing/child"),
        file: host.readFileText("/file"),
      },
      { missing: false, child: false, file: "FILE" },
    );

    host.mkdirp("/deep/a/b");
    host.mkdirp("/deep/a/b");
    TestValidator.equals(
      "mkdirp remains recursive and idempotent",
      await readdir(host.fs, "/deep/a"),
      ["b"],
    );
  };
