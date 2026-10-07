import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { retireLockDirectory } from "../../../../../packages/ttsc/src/internal/retireLockDirectory";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies retirement observes an actual open owner file on its native host.
 *
 * The supported yield closes the fixture's read descriptor. Windows refusal
 * requires that one yield before retirement; POSIX permits the rename while the
 * descriptor remains open. Supplied error codes in the probe-removal unit own
 * policy contrasts, not this native descriptor/rename connection.
 *
 * 1. Open current/owner.json and retire with the default filesystem operations.
 * 2. Require preserved owner bytes, the native yield count and no probe names.
 * 3. Require absent-source and occupied-tombstone retirement to return false
 *    without invoking a throwing yield.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual retirement owner must move the held record intact, remove current, yield once on Windows and zero times elsewhere, leave only the tombstone layout, and return false without waiting for both settled negative inputs.
 * @evidence contracts/testing.md#independent-expectations A real opened descriptor and literal owner bytes establish the native input. Windows versus POSIX rename semantics supply the expected yield count; exact directory populations and false results are authored independently of the operation.
 * @evidence contracts/testing.md#distinguishing-cases An open-file retirement contrasts with a missing source and a nonempty occupied destination; a throwing yield detects any retry of either settled negative. Exact directory listings expose probe leftovers. Native refusal is not replaced with scripted errno or selected-platform skipping.
 * @evidence contracts/testing.md#execution-ownership This source-unit imports the authored retirement operation and uses its default native filesystem/platform primitives. Its supported callback closes only its owned descriptor, and finally closes it on success or failure. It starts no child, compiler, installed consumer or product host; TestProject owns temporary cleanup. Installed-publication assertions retain their separate E2E owner.
 */
export function test_retirelockdirectory_observes_native_open_file_retirement(): void {
  const root = TestProject.tmpdir("ttsc-native-retire-unit-");
  const current = path.join(root, "current");
  const retired = path.join(root, "retired");
  const tombstone = path.join(retired, "0123456789abcdef0123456789abcdef");
  fs.mkdirSync(current);
  fs.mkdirSync(retired);
  fs.writeFileSync(path.join(current, "owner.json"), "{}\n", "utf8");
  let descriptor: number | undefined = fs.openSync(
    path.join(current, "owner.json"),
    "r",
  );
  let yields = 0;
  let retiredNow: boolean;
  try {
    retiredNow = retireLockDirectory(current, tombstone, () => {
      yields++;
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        descriptor = undefined;
      }
    });
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  const failures: Error[] = [];
  const check = (name: string, verify: () => void): void => {
    try {
      verify();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  check("native held generation retired", () => assert.equal(retiredNow, true));
  check("current removed", () => assert.equal(fs.existsSync(current), false));
  check("owner bytes preserved", () =>
    assert.equal(
      fs.readFileSync(path.join(tombstone, "owner.json"), "utf8"),
      "{}\n",
    ),
  );
  check("native yield count", () =>
    assert.equal(yields, process.platform === "win32" ? 1 : 0),
  );
  check("no root probe names", () =>
    assert.deepEqual(fs.readdirSync(root).sort(), ["retired"]),
  );
  check("exact tombstone population", () =>
    assert.deepEqual(fs.readdirSync(retired), [path.basename(tombstone)]),
  );
  const neverYields = (): void => {
    throw new Error("a settled retirement waited");
  };
  check("missing generation does not wait", () =>
    assert.equal(retireLockDirectory(current, tombstone, neverYields), false),
  );
  check("occupied tombstone does not wait", () => {
    fs.mkdirSync(current);
    assert.equal(retireLockDirectory(current, tombstone, neverYields), false);
  });
  if (failures.length)
    throw new AggregateError(failures, "native retirement assertions failed");
}
