import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { copiesPluginSourceEntry } from "../../../../../packages/ttsc/src/plugin/internal/source/copiesPluginSourceEntry";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source copying preserves keyed files and distinguishes entry kinds.
 *
 * A worktree .git file and a directory ending in ~ enter the selected snapshot,
 * while directory-name and file-name exclusions stay absent. A single copied
 * tree must preserve exactly that authored distinction before any compiler
 * runs.
 *
 * 1. Author regular source files, a worktree file and a backup-shaped directory.
 * 2. Contrast pruned directories, backup files, missing entries and a junction.
 * 3. Copy through the actual filter and compare literal paths and file bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual copiesPluginSourceEntry filter copies vendor/lib/dist/build source, the worktree .git file and notes~/notes.txt while rejecting repository/cache directories, backup/archive files, a missing entry and a directory link. The copied tree's digest equals its source digest.
 * @evidence contracts/testing.md#independent-expectations Authored literal relative paths and file contents define the expected copy independently of the filter and digest. Digest equality supplements these byte assertions and does not generate their expectations.
 * @evidence contracts/testing.md#distinguishing-cases The same .git spelling appears as an accepted file and a rejected nested directory; notes~ is an accepted directory while notes.txt~ is rejected as a file. Ordinary generated Go directories remain selected, named exclusions stay absent and a link cannot import unkeyed bytes; the test checks ttsc snapshot policy, not Go dependency membership.
 * @evidence contracts/testing.md#execution-ownership The source unit calls actual copy and digest operations on one owned temporary filesystem. It starts no compiler, metadata child, installed consumer or native subscription.
 */
export function test_source_copy_preserves_entry_kinds_and_keyed_bytes(): void {
  const root = TestProject.tmpdir("ttsc-source-copy-");
  const source = path.join(root, "source");
  const copied = path.join(root, "copied");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "source_copy_preserves_entry_kinds_and_keyed_bytes",
      "inputs-1",
    ),
    root,
  );
  for (const relative of [
    "source/main.go",
    "source/vendor/local/value.go",
    "source/lib/helper.go",
    "source/dist/generated.go",
    "source/build/generated.go",
    "source/node_modules/dependency/value.go",
    "outside/unkeyed.go",
  ])
    fs.renameSync(
      path.join(root, `${relative}.txt`),
      path.join(root, relative),
    );
  const expected = [
    ["main.go", "package main\n"],
    ["vendor/local/value.go", "package local\n"],
    ["lib/helper.go", "package helper\n"],
    ["dist/generated.go", "package generated\n"],
    ["build/generated.go", "package generated\n"],
    [".git", "gitdir: ../.git/worktrees/plugin\n"],
    ["notes~/notes.txt", "kept notes\n"],
  ] as const;
  for (const [relative, bytes] of expected) {
    const location = path.join(source, relative);
    if (!relative.endsWith(".go")) {
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.writeFileSync(location, bytes);
    }
    assert.equal(fs.readFileSync(location, "utf8"), bytes);
    assert.equal(copiesPluginSourceEntry(source, location), true, relative);
  }
  const omitted = [
    "nested/.git/objects",
    "node_modules/dependency/value.go",
    ".ttsc/cache",
    "notes.txt~",
    "archive.tgz",
    "go.work",
  ];
  for (const relative of omitted) {
    const location = path.join(source, relative);
    if (!relative.endsWith(".go")) {
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.writeFileSync(location, "excluded\n");
    }
    assert.equal(fs.readFileSync(location, "utf8"), "excluded\n");
  }
  for (const relative of [
    "nested/.git",
    "node_modules",
    ".ttsc",
    "notes.txt~",
    "archive.tgz",
    "go.work",
    "missing",
  ])
    assert.equal(
      copiesPluginSourceEntry(source, path.join(source, relative)),
      false,
      relative,
    );
  const outside = path.join(root, "outside");
  assert.equal(
    fs.readFileSync(path.join(outside, "unkeyed.go"), "utf8"),
    "package outside\n",
  );
  const link = path.join(source, "linked");
  fs.symlinkSync(
    outside,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(copiesPluginSourceEntry(source, link), false);
  // The digest rejects a source link; prove the copy refusal before removing it.
  fs.rmSync(link, { recursive: false });
  fs.cpSync(source, copied, {
    recursive: true,
    filter: (location) => copiesPluginSourceEntry(source, location),
  });
  const files = fs
    .readdirSync(copied, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(copied, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .sort();
  assert.deepEqual(files, expected.map(([relative]) => relative).sort());
  for (const [relative, bytes] of expected)
    assert.equal(
      fs.readFileSync(path.join(copied, relative), "utf8"),
      bytes,
      relative,
    );
  assert.equal(pluginSourceDigest(copied), pluginSourceDigest(source));
}
