import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import {
  callMutation,
  expectFsError,
  readdir,
} from "../../internal/callbackFs";

/**
 * The low-level mkdir callback creates one directory and preserves mkdirp
 * semantics.
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
