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
 * 5. Prefer selected identities over a system temp above the project or equal to
 *    an explicit config directory outside the declared project. With no
 *    selected cache, keep descriptor-load ancestor protection while an
 *    independent evaluator retains the historical system temp.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the real scratch allocator, checks native physical parents and ancestor metadata around creation and removal, and asserts each accepted owner has no temporary child afterward.
 * @evidence contracts/testing.md#independent-expectations Independently created ordinary, blocked, absent and linked cache entries define literal expected parents; native bigint project timestamps must stay fixed while entries change only below the preexisting identities child.
 * @evidence contracts/testing.md#distinguishing-cases Preexisting identities, absent record authority, descriptor-load versus independent strict-ancestor temp, identity and cache junctions, inside-project system temp, and each physical-temp/lexical-config volume relationship distinguish accepted same-volume storage from a cross-volume fallback.
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
  const expectParentWithDescriptorLoad = (
    descriptorLoad: "0" | "1",
    systemTemp: string,
    recordRoot: string,
    expected: string,
  ): void => {
    const previous = process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD;
    try {
      process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD = descriptorLoad;
      expectParent(systemTemp, recordRoot, expected);
    } finally {
      if (previous === undefined)
        delete process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD;
      else process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD = previous;
    }
  };

  const before = fs.statSync(project, { bigint: true });
  expectParent(otherVolumeTemp, project, identities);
  const after = fs.statSync(project, { bigint: true });
  assert.equal(after.mtimeNs, before.mtimeNs);
  assert.equal(after.ctimeNs, before.ctimeNs);

  const beforeAncestor = fs.statSync(parent, { bigint: true });
  const ancestorScratch = allocate(config, parent, project, project);
  try {
    assert.equal(
      path.dirname(ancestorScratch),
      fs.realpathSync.native(identities),
    );
  } finally {
    fs.rmdirSync(ancestorScratch);
  }
  const afterAncestor = fs.statSync(parent, { bigint: true });
  assert.equal(afterAncestor.mtimeNs, beforeAncestor.mtimeNs);
  assert.equal(afterAncestor.ctimeNs, beforeAncestor.ctimeNs);
  assert.deepEqual(fs.readdirSync(identities), []);
  expectParentWithDescriptorLoad("0", parent, "", parent);

  const externalConfigDir = TestProject.tmpdir("lint-external-config-", parent);
  const externalConfig = path.join(externalConfigDir, "lint.config.ts");
  try {
    fs.writeFileSync(externalConfig, "export default {};\n", "utf8");
    const beforeExternal = fs.statSync(externalConfigDir, { bigint: true });
    const externalScratch = allocate(
      externalConfig,
      externalConfigDir,
      project,
      project,
    );
    try {
      assert.equal(
        path.dirname(externalScratch),
        fs.realpathSync.native(identities),
      );
    } finally {
      fs.rmdirSync(externalScratch);
    }
    const afterExternal = fs.statSync(externalConfigDir, { bigint: true });
    assert.equal(afterExternal.mtimeNs, beforeExternal.mtimeNs);
    assert.equal(afterExternal.ctimeNs, beforeExternal.ctimeNs);
    assert.deepEqual(fs.readdirSync(identities), []);
  } finally {
    if (fs.existsSync(externalConfig)) fs.unlinkSync(externalConfig);
    fs.rmdirSync(externalConfigDir);
  }

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
  expectParentWithDescriptorLoad("1", parent, "", cache);
  expectParentWithDescriptorLoad(
    "0",
    parent,
    path.join(project, "unavailable-record-root"),
    cache,
  );
  fs.rmdirSync(cache);
  expectParent(otherVolumeTemp, "", cache);
  fs.rmdirSync(cache);

  const sameVolumeTemp = path.join(project, "system-temp");
  fs.mkdirSync(sameVolumeTemp);
  expectParent(sameVolumeTemp, "", cache);
  const sameVolumeAlias = path.join(project, "linked-same-volume-temp");
  fs.symlinkSync(sameVolumeTemp, sameVolumeAlias, "junction");
  try {
    expectParent(sameVolumeAlias, "", cache);
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
      expectParent(crossLexicalSamePhysical, "", cache);
    } finally {
      fs.unlinkSync(crossLexicalSamePhysical);
    }
    fs.rmdirSync(cache);
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
