import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import type { createConfigLoaderTempDirectory } from "../../../../../packages/lint/src/createTtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies cross-volume lint config scratch stays below a cache directory that
 * existed before a descriptor could observe missing project files.
 *
 * 1. Put a config and a blocked node_modules cache in a project on the current
 *    Windows volume; name another volume as the system temp location.
 * 2. Use the project itself as a record root with a preexisting identities child,
 *    then assert scratch creation and removal leave project metadata
 *    unchanged.
 * 3. Contrast available, blocked, linked and initially absent nearest cache
 *    directories without record authority, and reject an identities junction.
 * 4. Compare the canonical system-temp volume with the config's lexical volume
 *    through junctions in either direction, checking the actual scratch
 *    parent.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real scratch allocator, checks native physical parents and project metadata around creation and removal, and asserts each accepted owner has no temporary child afterward.
 * @evidence contracts/testing.md#independent-expectations Independently created ordinary, blocked, absent and linked cache entries define literal expected parents; native bigint project timestamps must stay fixed while entries change only below the preexisting identities child.
 * @evidence contracts/testing.md#distinguishing-cases Preexisting identities, absent record authority, identity and cache junctions, ordinary and aliased system temp, and each physical-temp/lexical-config volume relationship distinguish accepted same-volume storage from a cross-volume fallback.
 * @evidence contracts/testing.md#execution-ownership This Windows-specific source unit calls only the allocator over TestProject-owned temporary directories; it starts no compiler, evaluator, native plugin, or product host. A missing second writable volume omits only the physical cross-volume link cases.
 */
export function test_lint_config_loader_uses_preexisting_cache_directory(): void {
  if (process.platform !== "win32") return;

  const parent = path.join(
    TestProject.WORKSPACE_ROOT,
    "node_modules",
    ".cache",
  );
  const project = TestProject.tmpdir("lint-config-scratch-", parent);
  const config = path.join(project, "lint.config.ts");
  const identities = path.join(project, "identities");
  const nodeModules = path.join(project, "node_modules");
  const cache = path.join(nodeModules, ".cache");
  fs.writeFileSync(config, "export default {};\n", "utf8");
  fs.mkdirSync(identities);
  fs.mkdirSync(nodeModules);
  fs.writeFileSync(cache, "blocked");

  const projectVolume = path.parse(project).root;
  const otherVolumeTemp = projectVolume.toLowerCase().startsWith("c:")
    ? "D:\\unused-ttsc-temp"
    : "C:\\unused-ttsc-temp";
  const filename = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "lint",
    "src",
    "createTtscPlugin.ts",
  );
  const allocate = (
    createRequire(import.meta.url)(filename) as {
      createConfigLoaderTempDirectory: typeof createConfigLoaderTempDirectory;
    }
  ).createConfigLoaderTempDirectory;
  const expectParent = (
    systemTemp: string,
    recordRoot: string,
    expected: string,
  ): void => {
    const beforeEntries = fs.existsSync(expected)
      ? fs.readdirSync(expected)
      : [];
    const directory = allocate(config, systemTemp, recordRoot);
    try {
      assert.equal(path.dirname(directory), fs.realpathSync.native(expected));
    } finally {
      fs.rmdirSync(directory);
    }
    assert.deepEqual(fs.readdirSync(expected), beforeEntries);
  };

  const before = fs.statSync(project, { bigint: true });
  expectParent(otherVolumeTemp, project, identities);
  const after = fs.statSync(project, { bigint: true });
  assert.equal(after.mtimeNs, before.mtimeNs);
  assert.equal(after.ctimeNs, before.ctimeNs);

  expectParent(otherVolumeTemp, "", project);

  fs.rmdirSync(identities);
  fs.symlinkSync(project, identities, "junction");
  try {
    expectParent(otherVolumeTemp, project, project);
  } finally {
    fs.unlinkSync(identities);
  }

  fs.unlinkSync(cache);
  fs.mkdirSync(cache);
  expectParent(otherVolumeTemp, "", cache);
  fs.rmdirSync(cache);
  expectParent(otherVolumeTemp, "", cache);
  fs.rmdirSync(cache);

  const sameVolumeTemp = path.join(project, "system-temp");
  fs.mkdirSync(sameVolumeTemp);
  expectParent(sameVolumeTemp, "", sameVolumeTemp);
  const sameVolumeAlias = path.join(project, "linked-same-volume-temp");
  fs.symlinkSync(sameVolumeTemp, sameVolumeAlias, "junction");
  try {
    expectParent(sameVolumeAlias, "", sameVolumeTemp);
  } finally {
    fs.unlinkSync(sameVolumeAlias);
  }

  const physicalOtherVolume =
    path.parse(fs.realpathSync.native(os.tmpdir())).root.toLowerCase() ===
    projectVolume.toLowerCase()
      ? undefined
      : TestProject.tmpdir("lint-config-other-volume-");
  if (physicalOtherVolume !== undefined) {
    const crossLexicalSamePhysical = path.join(
      physicalOtherVolume,
      "linked-same-physical-temp",
    );
    fs.symlinkSync(sameVolumeTemp, crossLexicalSamePhysical, "junction");
    try {
      expectParent(crossLexicalSamePhysical, "", sameVolumeTemp);
    } finally {
      fs.unlinkSync(crossLexicalSamePhysical);
    }
    fs.symlinkSync(physicalOtherVolume, cache, "junction");
    try {
      expectParent(otherVolumeTemp, "", project);
    } finally {
      fs.unlinkSync(cache);
    }
    fs.mkdirSync(identities);
    const linkedSystemTemp = path.join(project, "linked-system-temp");
    fs.symlinkSync(physicalOtherVolume, linkedSystemTemp, "junction");
    try {
      const beforeLinked = fs.statSync(project, { bigint: true });
      expectParent(linkedSystemTemp, project, identities);
      const afterLinked = fs.statSync(project, { bigint: true });
      assert.equal(afterLinked.mtimeNs, beforeLinked.mtimeNs);
      assert.equal(afterLinked.ctimeNs, beforeLinked.ctimeNs);
      expectParent(linkedSystemTemp, "", cache);
    } finally {
      fs.unlinkSync(linkedSystemTemp);
    }
  }
}
