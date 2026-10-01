import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { mergeProjectInputSnapshots as installedOperation } from "../../../../../../../packages/ttsc/lib/compiler/internal/build/mergeProjectInputSnapshots.js";

/**
 * Verifies project-input merge keys follow physical filesystem identities.
 *
 * Lexical path folding cannot distinguish a case-sensitive Windows directory,
 * while plain `path.resolve` cannot join symlink, 8.3, or extended aliases.
 * Missing declarations need the same identity as their nearest existing
 * ancestor without requiring the declared file or glob population to exist.
 *
 * 1. Merge root, existing file, missing file, and glob declarations through
 *    symlink plus available Windows case, 8.3, and extended aliases.
 * 2. Prove aliases are order-independent and missing case aliases follow the
 *    nearest existing directory's actual case semantics.
 * 3. Under a case-sensitive directory, keep case-distinct roots and entries
 *    separate, including missing descendants.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual packed-SDK snapshot operation unifies physical symlink aliases and supported Windows case/short/extended aliases while preserving sensitive existing and missing entries; order reversal must retain the same canonical snapshot.
 * @evidence contracts/testing.md#independent-expectations Authored physical files, real native paths and literal expected population sizes/canonical paths establish alias identity; fsutil success and distinct real roots independently establish sensitive authority.
 * @evidence contracts/testing.md#distinguishing-cases Existing/missing file, glob, reload-file/directory aliases and ordering remain covered; Windows short/extended/case aliases are observed when present, Linux/Windows sensitive roots remain distinct, and the original macOS sensitive-population omission is preserved.
 * @evidence contracts/testing.md#execution-ownership This named os-boundaries/watch entry runs the supplied packed-SDK snapshot operation against the actual installation platform's filesystem and Windows tools within the sole installation matrix, separately from Linux unit and E2E populations.
 * @evidence contracts/e2e.md#necessary-boundary Actual junction/symlink, Windows short/namespaced aliases and filesystem case flags must agree with the identity owner; injected path authority cannot prove these native relations.
 * @evidence contracts/e2e.md#shared-execution One private filesystem fixture supplies all alias consumers and sensitive transitions in the installation OS batch; no independent consumer install, compiler run, Go build or watch host is created.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private roots isolate links and Windows directory flags; fresh snapshots carry the changed root premises without global fs replacement. Synchronous helper processes terminate before assertions and no watch handle remains.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion, Windows alias availability check and macOS sensitive-population condition remains mechanically unchanged in this named actual OS entry.
 */
export function case_project_input_snapshot_merge_uses_filesystem_identities(mergeProjectInputSnapshots: typeof installedOperation = installedOperation) {
    const fixtureRoot = TestProject.tmpdir("ttsc-project-input-identity-");
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
  const result = child_process.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(
    result.status,
    0,
    `failed to enable Windows per-directory case sensitivity: ${
      result.error?.message ?? result.stderr.trim()
    }`,
  );
}

function windowsShortPath(location: string): string | undefined {
  const command = `for %I in ("${location}") do @echo %~sI`;
  const result = child_process.spawnSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command],
    {
      encoding: "utf8",
      windowsHide: true,
      windowsVerbatimArguments: true,
    },
  );
  const output = result.status === 0 ? result.stdout.trim() : "";
  return output.length === 0 ? undefined : output;
}
