import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies temporary environment selection preserves owned native coordinates.
 *
 * Environment objects keep the operation independent of the running suite's
 * startup state while actual directories and junctions establish path identity.
 *
 * 1. Preserve an ignored parent and resolve a linked spelling to that parent.
 * 2. Replace outside, unignored, missing and file parents with checkout storage.
 * 3. Verify all temporary names agree and unrelated environment values survive.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls configureTemporaryEnvironment on actual ignored directories and a directory link, then verifies TEMP/TMP/TMPDIR share the physical selected path. Rejected roots select existing checkout cache infrastructure without creating the missing candidate or changing unrelated environment values.
 * @evidence contracts/testing.md#independent-expectations Native realpath independently establishes the authored link target. The repository root is outside the permitted ignored subtree, its filesystem root is outside checkout containment, and the absent ignored child must remain absent. Those inputs must select the literal ignored checkout cache parent.
 * @evidence contracts/testing.md#distinguishing-cases Existing ignored input, its linked alias, unignored checkout/package roots, an outside filesystem root, a missing ignored child, an ignored regular file and a child below that file exercise retention, canonicalization and fallback. An owned junction pointing outside the checkout also must select fallback, without touching its target.
 * @evidence contracts/testing.md#execution-ownership The normal exported unit invokes the actual test allocation owner in this process with isolated environment objects. It creates and removes only one ignored fixture root and its directory links, runs Git ignore checks but no product host, native producer, build or installation.
 */
export function test_testproject_temporary_environment_preserves_owned_physical_coordinates(): void {
  const root = TestProject.tmpdir(
    "ttsc-temporary-environment-",
    path.join(TestProject.WORKSPACE_ROOT, ".cache"),
  );
  const fallback = fs.realpathSync.native(
    path.join(TestProject.WORKSPACE_ROOT, ".cache"),
  );
  try {
    const actual = path.join(root, "actual");
    fs.mkdirSync(actual);
    const alias = path.join(root, "alias");
    fs.symlinkSync(actual, alias, "junction");
    const outside = path.parse(fs.realpathSync.native(root)).root;
    const escaped = path.join(root, "escaped");
    fs.symlinkSync(outside, escaped, "junction");
    const missing = path.join(root, "missing");
    const file = path.join(root, "file");
    fs.writeFileSync(file, "unchanged file input");
    for (const [inherited, expected] of [
      [actual, fs.realpathSync.native(actual)],
      [alias, fs.realpathSync.native(actual)],
      [TestProject.WORKSPACE_ROOT, fallback],
      [TestProject.TEST_PACKAGE_ROOT, fallback],
      [outside, fallback],
      [escaped, fallback],
      [missing, fallback],
      [file, fallback],
      [path.join(file, "child"), fallback],
    ] as const) {
      const env: NodeJS.ProcessEnv = {
        TEMP: "prior-temp",
        TMP: "prior-tmp",
        TMPDIR: "prior-tmpdir",
        TTSC_TEMPORARY_CONTROL: "unchanged",
      };
      assert.equal(
        TestProject.configureTemporaryEnvironment(env, inherited),
        expected,
      );
      assert.deepEqual(env, {
        TEMP: expected,
        TMP: expected,
        TMPDIR: expected,
        GIT_CEILING_DIRECTORIES: expected.split(path.sep).join("/"),
        TTSC_TEMPORARY_CONTROL: "unchanged",
      });
    }
    assert.equal(fs.existsSync(missing), false);
    assert.equal(fs.readFileSync(file, "utf8"), "unchanged file input");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
