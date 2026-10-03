import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { mergeProjectInputSnapshots } from "../../../../../packages/ttsc/src/compiler/internal/build/mergeProjectInputSnapshots";

/**
 * Retains the original native filesystem identity merge population.
 *
 * Actual directory junction/symlink aliases and available Windows case, short
 * and namespaced aliases carry existing and missing declarations. Windows
 * sensitive-directory preparation and Linux case-distinct fixtures remain
 * native; the original Darwin sensitive-population omission is preserved.
 *
 * @evidence contracts/testing.md#behavioral-verification Imports actual mergeProjectInputSnapshots and checks original reverse-order canonical equality, files/globs/reload populations and exact paths, Windows missing-case folding, sensitive distinct roots and mismatched-root refusal, and sensitive populations 4/2/4/4.
 * @evidence contracts/testing.md#independent-expectations Authored native entries, independent fs.realpathSync paths and literal counts/canonical paths supply expectations. Successful fsutil preparation and distinct physical roots establish the fixture premises; these expectations do not branch on the resolver's own mode. Unavailable Windows aliases remain conditional as in the donor, not certified identities.
 * @evidence contracts/testing.md#distinguishing-cases Keeps existing versus missing declarations, junction/dir-symlink versus physical paths, reversed producers, four snapshot categories, available Windows case/short/namespaced aliases, Windows insensitive missing suffixes and Windows/Linux sensitive entries. Darwin retains the original sensitive-population return. Supplied-policy and virtual memoization units are separate contributions.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the owning operation against private native roots and actual fsutil/cmd helpers without an installed consumer, compiler, Go build, foreign replacement or guessed authority. Command preparation errors/signals remain distinct from ordinary exit and optional short-alias availability; cleanup failures are retained. Native classifier correctness, actual selection and execution are not certified by authored body existence.
 */
export function test_project_input_snapshot_merge_uses_filesystem_identities(): void {
  const fixtureRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-project-input-identity-"),
  );
  const failures: Error[] = [];
  try {
    exercise();
  } catch (cause) {
    failures.push(
      new Error("native snapshot merge inputs and observations", { cause }),
    );
  } finally {
    try {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("native snapshot merge root cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "native snapshot merge observations failed",
    );

  function exercise(): void {
    const physicalRoot = path.join(fixtureRoot, "physical-project");
    const existingFile = path.join(physicalRoot, "docs", "spec.md");
    fs.mkdirSync(path.dirname(existingFile), { recursive: true });
    fs.mkdirSync(path.join(physicalRoot, "api"), { recursive: true });
    fs.writeFileSync(existingFile, "evidence\n", "utf8");

    const linkedRoot = path.join(fixtureRoot, "linked-project");
    fs.symlinkSync(
      physicalRoot,
      linkedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );

    const rootAliases = new Set<string>([physicalRoot, linkedRoot]);
    if (process.platform === "win32") {
      rootAliases.add(path.toNamespacedPath(physicalRoot));
      const caseAlias = alternateCase(physicalRoot);
      if (
        fs.existsSync(caseAlias) &&
        realpath(caseAlias) === realpath(physicalRoot)
      ) {
        rootAliases.add(caseAlias);
      }
      const shortAlias = windowsShortPath(physicalRoot);
      if (shortAlias !== undefined && fs.existsSync(shortAlias)) {
        rootAliases.add(shortAlias);
      }
    }

    const snapshots = [...rootAliases].map((root) => ({
      root,
      files: [
        path.join(root, "docs", "spec.md"),
        path.join(root, "future", "missing.md"),
      ],
      globs: [path.join(root, "api", "**", "*.json")],
      reloadFiles: [
        path.join(root, "docs", "spec.md"),
        path.join(root, "future", "missing.md"),
      ],
      reloadDirectories: [
        path.join(root, "api"),
        path.join(root, "future", "packages"),
      ],
    }));
    const merged = mergeProjectInputSnapshots(physicalRoot, snapshots);
    assert.deepEqual(
      mergeProjectInputSnapshots(physicalRoot, [...snapshots].reverse()),
      merged,
      "the canonical snapshot must not depend on producer or alias order",
    );
    assert.equal(
      merged.files.length,
      2,
      "existing and missing aliases must each have one physical identity",
    );
    assert.equal(
      merged.globs.length,
      1,
      "glob aliases must inherit the existing api directory identity",
    );
    assert.equal(
      merged.reloadFiles?.length,
      2,
      "reload aliases must use the same existing and missing identities",
    );
    assert.equal(
      merged.reloadDirectories?.length,
      2,
      "reload-directory aliases must use physical directory identities",
    );
    const physical = realpath(physicalRoot);
    assert.equal(merged.root, physical);
    assert.equal(merged.files[0], path.join(physical, "docs", "spec.md"));
    assert.equal(merged.files[1], path.join(physical, "future", "missing.md"));
    assert.equal(
      merged.globs[0],
      path.join(physical, "api", "**", "*.json").split(path.sep).join("/"),
    );
    assert.deepEqual(merged.reloadFiles, merged.files);
    assert.deepEqual(merged.reloadDirectories, [
      path.join(physical, "api"),
      path.join(physical, "future", "packages"),
    ]);

    if (process.platform === "win32") {
      const missingCaseAliases = mergeProjectInputSnapshots(physicalRoot, [
        {
          root: physicalRoot,
          files: [
            path.join(physicalRoot, "Future", "Spec.md"),
            path.join(physicalRoot, "future", "spec.md"),
          ],
          globs: [],
        },
      ]);
      assert.deepEqual(
        missingCaseAliases.files,
        [path.join(physical, "future", "spec.md")],
        "missing suffix aliases must fold under a default insensitive directory",
      );
    }

    // The default macOS volume does not provide two case-distinct entries.
    // Windows explicitly enables the directory flag below; Linux volumes used
    // by the supported test lanes are case-sensitive by default.
    if (process.platform === "darwin") return;
    const caseRoot = path.join(fixtureRoot, "case-sensitive");
    fs.mkdirSync(caseRoot);
    enableWindowsCaseSensitivity(caseRoot);
    const upperRoot = path.join(caseRoot, "Project");
    const lowerRoot = path.join(caseRoot, "project");
    fs.mkdirSync(upperRoot);
    fs.mkdirSync(lowerRoot);
    assert.notEqual(
      realpath(upperRoot),
      realpath(lowerRoot),
      "the case-sensitive test directory must retain distinct root identities",
    );

    assert.throws(
      () =>
        mergeProjectInputSnapshots(upperRoot, [
          { root: lowerRoot, files: [], globs: [] },
        ]),
      /differs from the selected project root/,
      "case-distinct physical roots must not share one Windows key",
    );

    const upperFile = path.join(upperRoot, "docs", "Spec.md");
    const lowerFile = path.join(upperRoot, "docs", "spec.md");
    fs.mkdirSync(path.dirname(upperFile), { recursive: true });
    fs.writeFileSync(upperFile, "upper\n", "utf8");
    fs.writeFileSync(lowerFile, "lower\n", "utf8");
    fs.mkdirSync(path.join(upperRoot, "Api"));
    fs.mkdirSync(path.join(upperRoot, "api"));
    const caseDistinct = mergeProjectInputSnapshots(upperRoot, [
      {
        root: upperRoot,
        files: [
          upperFile,
          lowerFile,
          path.join(upperRoot, "Future", "missing.md"),
          path.join(upperRoot, "future", "missing.md"),
        ],
        globs: [
          path.join(upperRoot, "Api", "**", "*.json"),
          path.join(upperRoot, "api", "**", "*.json"),
        ],
        reloadFiles: [
          upperFile,
          lowerFile,
          path.join(upperRoot, "Future", "config.json"),
          path.join(upperRoot, "future", "config.json"),
        ],
        reloadDirectories: [
          path.join(upperRoot, "Api"),
          path.join(upperRoot, "api"),
          path.join(upperRoot, "Future", "packages"),
          path.join(upperRoot, "future", "packages"),
        ],
      },
    ]);
    assert.equal(caseDistinct.files.length, 4);
    assert.equal(caseDistinct.globs.length, 2);
    assert.equal(caseDistinct.reloadFiles?.length, 4);
    assert.equal(caseDistinct.reloadDirectories?.length, 4);
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}

function alternateCase(location: string): string {
  return location.replace(/[A-Za-z]/g, (character) =>
    character === character.toLowerCase()
      ? character.toUpperCase()
      : character.toLowerCase(),
  );
}

function enableWindowsCaseSensitivity(directory: string): void {
  if (process.platform !== "win32") return;
  const result = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  const details = JSON.stringify({
    directory,
    error: result.error?.message,
    signal: result.signal,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  assert.equal(result.error, undefined, `fsutil preparation error: ${details}`);
  assert.equal(result.signal, null, `fsutil signal termination: ${details}`);
  assert.equal(
    result.status,
    0,
    `failed to enable Windows per-directory case sensitivity: ${details}`,
  );
}

function windowsShortPath(location: string): string | undefined {
  const command = `for %I in ("${location}") do @echo %~sI`;
  const result = childProcess.spawnSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command],
    {
      encoding: "utf8",
      windowsHide: true,
      windowsVerbatimArguments: true,
    },
  );
  const details = JSON.stringify({
    location,
    command,
    error: result.error?.message,
    signal: result.signal,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });
  assert.equal(
    result.error,
    undefined,
    `short-path command preparation error: ${details}`,
  );
  assert.equal(
    result.signal,
    null,
    `short-path command signal termination: ${details}`,
  );
  // Preserve ordinary nonzero/empty-output alias unavailability from the donor.
  if (result.status !== 0 || result.stdout.trim().length === 0)
    console.log("native short-path alias unavailable", details);
  const output = result.status === 0 ? result.stdout.trim() : "";
  return output.length === 0 ? undefined : output;
}
