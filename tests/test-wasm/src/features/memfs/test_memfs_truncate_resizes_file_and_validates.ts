import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, expectFsError } from "../../internal/callbackFs";

/**
 * Verifies MemFS truncate shrinks and zero-extends file bytes and validates its
 * path and length.
 *
 * The pre-fix `truncate` was a no-op that returned success without touching any
 * node, so a caller that truncated then read saw stale bytes. It must follow
 * the POSIX contract: shrink drops trailing bytes, grow zero-fills the
 * extension, a negative length is EINVAL, a directory is EISDIR, and a missing
 * path is ENOENT.
 *
 * 1. Seed `/t.txt`="abcdef", shrink to 2, then grow to 5.
 * 2. Read back the resized bytes.
 * 3. Truncate to zero, reject negative, fractional and nonfinite lengths, a
 *    directory and a missing path, then verify the empty file stays intact.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.truncate shrinks path-addressed bytes, zero-extends growth and empties at length zero, while rejecting malformed lengths, directory and missing targets. Literal prefix, grown bytes and retained empty file distinguish a no-op or mutation before rejection.
 * @evidence contracts/testing.md#independent-expectations POSIX file truncation preserves the prefix and appends NUL bytes when growing. Authored abcdef independently yields ab then [0x61,0x62,0,0,0], with EINVAL/EISDIR/ENOENT for the invalid inputs.
 * @evidence contracts/testing.md#distinguishing-cases Six-to-two shrink, two-to-five growth and zero length cover size directions and the empty boundary; negative, fractional, NaN and infinite lengths, directory and absent file cover validation. Descriptor identity and access restrictions are tested by ftruncate siblings.
 * @evidence contracts/testing.md#execution-ownership test_memfs_truncate_resizes_file_and_validates directly invokes fs.truncate through callMutation/expectFsError and reads bytes from createMemFS. This one Node source-unit entry owns all resized states and named failure results.
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

    await callMutation((cb) => host.fs.truncate("/t.txt", 0, cb));
    TestValidator.equals(
      "zero length empties the file",
      host.readFileText("/t.txt"),
      "",
    );
    const codes = {
      negative: await expectFsError((cb) => host.fs.truncate("/t.txt", -1, cb)),
      fractional: await expectFsError((cb) => host.fs.truncate("/t.txt", 0.5, cb)),
      nan: await expectFsError((cb) => host.fs.truncate("/t.txt", NaN, cb)),
      infinite: await expectFsError((cb) => host.fs.truncate("/t.txt", Infinity, cb)),
      directory: await expectFsError((cb) => host.fs.truncate("/dir", 0, cb)),
      missing: await expectFsError((cb) => host.fs.truncate("/nope", 0, cb)),
    };
    TestValidator.equals("rejection codes", codes, {
      negative: "EINVAL",
      fractional: "EINVAL",
      nan: "EINVAL",
      infinite: "EINVAL",
      directory: "EISDIR",
      missing: "ENOENT",
    });
    TestValidator.equals(
      "invalid lengths preserve the empty file",
      host.readFileText("/t.txt"),
      "",
    );
  };
