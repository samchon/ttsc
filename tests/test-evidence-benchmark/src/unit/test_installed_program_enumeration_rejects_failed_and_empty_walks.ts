import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { enumerateInstalledPrograms } from "../internal/enumerateInstalledPrograms";

/**
 * Verifies executable enumeration rejects failed and empty observations.
 *
 * A path-budget loop over nothing cannot prove an installed program fits.
 * Native missing and non-directory roots must retain their filesystem failures,
 * while nested regular executables provide the independent positive population.
 *
 * 1. Read empty and missing roots and require explicit failures.
 * 2. Read a regular file as a directory and retain its native error.
 * 3. Enumerate mixed-case nested executables across two actual roots.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored directory enumerator on real temporary roots, requiring empty-population rejection, ENOENT and non-directory failures, then the exact two regular executable paths.
 * @evidence contracts/testing.md#independent-expectations Authored run.exe/tool.EXE files independently define the expected population; text files and an .exe-named directory are not regular executable files.
 * @evidence contracts/testing.md#distinguishing-cases Missing, empty, non-directory and populated roots contrast with one empty sibling root, mixed-case extensions and a nested directory whose name ends in .exe.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export exercises ordinary Node enumeration and path selection directly, without installation, executable startup or a compiler; its exact temporary root is removed in finally.
 */
export function test_installed_program_enumeration_rejects_failed_and_empty_walks(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-installed-programs-unit-"),
  );
  try {
    const empty = path.join(root, "empty");
    fs.mkdirSync(empty);
    assert.throws(
      () => enumerateInstalledPrograms([empty]),
      /No installed executable/,
    );
    assert.throws(() => enumerateInstalledPrograms([]), /No installed executable/);
    assert.throws(
      () => enumerateInstalledPrograms([path.join(root, "missing")]),
      { code: "ENOENT" },
    );
    const regular = path.join(root, "regular");
    fs.writeFileSync(regular, "not a directory");
    assert.throws(() => enumerateInstalledPrograms([regular]));
    const store = path.join(root, "store");
    const workspace = path.join(root, "workspace");
    fs.mkdirSync(path.join(store, "directory.exe"), { recursive: true });
    fs.mkdirSync(workspace);
    const first = path.join(store, "directory.exe", "tool.EXE");
    const second = path.join(workspace, "run.exe");
    fs.writeFileSync(first, "observed tool");
    fs.writeFileSync(second, "observed program");
    fs.writeFileSync(path.join(store, "readme.txt"), "ignored text");
    assert.deepEqual(
      enumerateInstalledPrograms([store, workspace, empty]).sort(),
      [first, second].sort(),
    );
    assert.throws(
      () => enumerateInstalledPrograms([store, path.join(root, "missing")]),
      { code: "ENOENT" },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
