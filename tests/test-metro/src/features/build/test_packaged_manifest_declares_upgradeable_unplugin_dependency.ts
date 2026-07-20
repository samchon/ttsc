import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the published @ttsc/metro manifest permits compatible unplugin
 * upgrades.
 *
 * Metro leaves @ttsc/unplugin external, so an exact published dependency forces
 * every consumer to wait for a Metro republish before accepting an unplugin
 * patch. The artifact manifest is the consumer contract because pnpm expands
 * workspace protocols while packing.
 *
 * 1. Pack @ttsc/metro and extract its published package manifest.
 * 2. Assert @ttsc/unplugin is a concrete caret runtime dependency that admits the
 *    next compatible patch, while an exact pin is rejected.
 * 3. Assert that range rejects its next incompatible semver boundary.
 */
export const test_packaged_manifest_declares_upgradeable_unplugin_dependency =
  () => {
    const manifest = readPackedManifest();
    const dependency = manifest.dependencies?.["@ttsc/unplugin"];
    assert.ok(
      typeof dependency === "string",
      "published Metro manifest needs an @ttsc/unplugin runtime dependency",
    );
    assertCompatibleCaretRange(dependency, "@ttsc/unplugin");
    assert.throws(
      () => assertCompatibleCaretRange(dependency.slice(1), "@ttsc/unplugin"),
      /caret range/,
      "an exact @ttsc/unplugin pin must not satisfy the upgradeable dependency contract",
    );
  };

function readPackedManifest(): Record<string, any> {
  const packageDir = path.join(TestProject.WORKSPACE_ROOT, "packages", "metro");
  const destination = TestProject.tmpdir("ttsc-metro-pack-");
  const pack = spawnSync("pnpm", ["pack", "--pack-destination", destination], {
    cwd: packageDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(pack.status, 0, `pnpm pack failed:\n${pack.stderr}`);

  const tarball = fs
    .readdirSync(destination)
    .find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "pnpm pack produced no Metro tarball");
  const manifest = spawnSync(
    "tar",
    ["-xzOf", tarball, "package/package.json"],
    {
      cwd: destination,
      encoding: "utf8",
    },
  );
  assert.equal(
    manifest.status,
    0,
    `tar extraction failed:\n${manifest.stderr}`,
  );
  return JSON.parse(manifest.stdout);
}

function assertCompatibleCaretRange(range: string, dependency: string): void {
  const match =
    /^\^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      range,
    );
  assert.ok(
    match,
    `${dependency} must publish a caret range, received ${range}`,
  );
  const major = Number(match[1]!);
  const minor = Number(match[2]!);
  const patch = Number(match[3]!);
  const lower: [number, number, number] = [major, minor, patch];
  const upper: [number, number, number] =
    major > 0
      ? [major + 1, 0, 0]
      : minor > 0
        ? [0, minor + 1, 0]
        : [0, 0, patch + 1];
  const accepts = (candidate: [number, number, number]): boolean =>
    compareVersions(candidate, lower) >= 0 &&
    compareVersions(candidate, upper) < 0;

  if (minor > 0 || major > 0) {
    assert.equal(accepts([major, minor, patch + 1]), true);
  }
  assert.equal(accepts(upper), false);
}

function compareVersions(
  left: [number, number, number],
  right: [number, number, number],
): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}
