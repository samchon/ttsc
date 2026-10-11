import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * One producer's project-input snapshot, as the merge operation reads it.
 *
 * @evidence contracts/common.md#principled-implementation The fields mirror the merge operation's own snapshot, so the source and installed operations accept it unchanged.
 * @evidence contracts/common.md#clear-and-simple-design One structural shape lets both owners pass their operation without importing either one's types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The shape adds no field the operation does not read.
 * @evidence contracts/common.md#meaningful-documentation The summary names the producer and consumer of the shape.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A type declaration performs no platform operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration performs no work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration performs no work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration retains nothing.
 */
export interface IProjectInputSnapshotForMerge {
  root: string;
  files: readonly string[];
  globs: readonly string[];
  reloadFiles?: readonly string[];
  reloadDirectories?: readonly string[];
}

/**
 * Verify a project-input snapshot merge against native filesystem identities.
 *
 * The source unit passes the authored `mergeProjectInputSnapshots`; the
 * installation E2E passes the one its packed SDK publishes, so both run the
 * same native population. Actual directory junction or symlink aliases and the
 * available Windows case, short and namespaced aliases carry existing and
 * missing declarations; a Windows case-sensitive directory and Linux's
 * case-distinct entries supply distinct identities. The default macOS volume
 * offers no case-distinct entries, so that population ends there.
 *
 * @param mergeProjectInputSnapshots The merge operation under test.
 * @evidence contracts/common.md#principled-implementation Native junctions, realpath, fsutil and cmd short-name expansion establish every alias and premise; expectations never branch on the operation's own answer.
 * @evidence contracts/common.md#clear-and-simple-design One population serves the source and installed owners of the same operation, so neither copy drifts.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable Windows aliases are reported and left out rather than fabricated; failed preparation commands fail with their raw results.
 * @evidence contracts/common.md#meaningful-documentation The paragraph names the alias kinds, both callers and why the macOS population ends early.
 * @evidence contracts/portability.md#os-neutral-implementation Junctions on Windows and directory symlinks elsewhere, path.toNamespacedPath and native realpath observe each platform's own aliases.
 * @evidence contracts/performance.md#efficient-algorithms A fixed population of a few snapshots and directories, plus at most two short helper commands on Windows.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call observes a fresh native population; nothing is cached across callers.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The fixture root is removed in finally, and a cleanup failure is reported with any observation failure.
 */
export function verifyProjectInputSnapshotMerge(
  mergeProjectInputSnapshots: (
    projectRoot: string,
    snapshots: readonly IProjectInputSnapshotForMerge[],
  ) => IProjectInputSnapshotForMerge,
): void {
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
  // An ordinary nonzero or empty answer means the volume offers no short name.
  if (result.status !== 0 || result.stdout.trim().length === 0)
    console.log("native short-path alias unavailable", details);
  const output = result.status === 0 ? result.stdout.trim() : "";
  return output.length === 0 ? undefined : output;
}
