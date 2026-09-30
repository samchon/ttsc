import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, expectFsError } from "../../internal/callbackFs";

/**
 * Verifies MemFS truncate shrinks and zero-extends file bytes and validates its
 * path and length.
 *
 * The pre-fix `truncate` was a no-op that returned success without touching any
 * node, so a caller that truncated then read saw stale bytes. RA-13 requires
 * the real POSIX contract: shrink drops trailing bytes, grow zero-fills the
 * extension, a negative length is EINVAL, a directory is EISDIR, and a missing
 * path is ENOENT.
 *
 * 1. Seed `/t.txt`="abcdef", shrink to 2, then grow to 5.
 * 2. Read back the resized bytes.
 * 3. Assert "ab" survives, the grown tail is zero-filled to length 5, and each
 *    invalid call carries its expected code.
 */
export const test_memfs_truncate_resizes_file_and_validates =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/t.txt", "abcdef");
    host.mkdirp("/dir");

    await callMutation((cb) => host.fs.truncate("/t.txt", 2, cb));
    TestValidator.equals(
      "shrink drops trailing bytes",
      host.readFileText("/t.txt"),
      "ab",
    );

    await callMutation((cb) => host.fs.truncate("/t.txt", 5, cb));
    const grown = host.readFile("/t.txt");
    TestValidator.equals(
      "grow zero-fills to exact length",
      grown === null ? null : [...grown],
      [0x61, 0x62, 0, 0, 0],
    );

    const codes = {
      negative: await expectFsError((cb) => host.fs.truncate("/t.txt", -1, cb)),
      directory: await expectFsError((cb) => host.fs.truncate("/dir", 0, cb)),
      missing: await expectFsError((cb) => host.fs.truncate("/nope", 0, cb)),
    };
    TestValidator.equals("rejection codes", codes, {
      negative: "EINVAL",
      directory: "EISDIR",
      missing: "ENOENT",
    });
  };
