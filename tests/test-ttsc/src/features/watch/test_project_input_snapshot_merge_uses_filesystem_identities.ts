import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { mergeProjectInputSnapshots } from "../../../../../packages/ttsc/lib/compiler/internal/runBuild.js";

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
 * 2. Under a case-sensitive directory, keep case-distinct roots and entries
 *    separate, including missing descendants.
 * 3. Assert only aliases that the filesystem resolves to one identity dedupe.
 */
export const test_project_input_snapshot_merge_uses_filesystem_identities =
  (): void => {
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
    }));
    const merged = mergeProjectInputSnapshots(physicalRoot, snapshots);
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
    assert.equal(merged.root, path.resolve(physicalRoot));

    const caseRoot = path.join(fixtureRoot, "case-sensitive");
    fs.mkdirSync(caseRoot);
    enableWindowsCaseSensitivity(caseRoot);
    const upperRoot = path.join(caseRoot, "Project");
    const lowerRoot = path.join(caseRoot, "project");
    fs.mkdirSync(upperRoot);
    try {
      fs.mkdirSync(lowerRoot);
    } catch {
      return;
    }
    if (realpath(upperRoot) === realpath(lowerRoot)) return;

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
      },
    ]);
    assert.equal(caseDistinct.files.length, 4);
    assert.equal(caseDistinct.globs.length, 2);
    assert.equal(caseDistinct.reloadFiles?.length, 4);
  };

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
  child_process.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", directory, "enable"],
    {
      encoding: "utf8",
      windowsHide: true,
    },
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
