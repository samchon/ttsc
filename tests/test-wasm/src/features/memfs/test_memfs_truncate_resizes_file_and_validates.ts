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
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.truncate shrinks path-addressed bytes and zero-extends growth, while rejecting negative length, directory and missing targets. Literal prefix and grown bytes distinguish a success-reporting no-op.
 * @evidence contracts/testing.md#independent-expectations POSIX file truncation preserves the prefix and appends NUL bytes when growing. Authored abcdef independently yields ab then [0x61,0x62,0,0,0], with EINVAL/EISDIR/ENOENT for the invalid inputs.
 * @evidence contracts/testing.md#distinguishing-cases Six-to-two shrink and two-to-five growth cover both size directions; negative size, directory and absent file cover validation. Descriptor identity and access restrictions are tested by ftruncate siblings.
 * @evidence contracts/testing.md#execution-ownership test_memfs_truncate_resizes_file_and_validates directly invokes fs.truncate through callMutation/expectFsError and reads bytes from createMemFS. This one Node source-unit entry owns both resized states and the three named failure results.
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
