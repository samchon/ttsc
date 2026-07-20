import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the published @ttsc/graph manifest permits compatible ttsc upgrades.
 *
 * The graph server runs inside the consumer's ttsc host, so an exact peer pin
 * makes a normal independent patch upgrade fail npm's peer solver. Reading the
 * packed manifest tests the release artifact, where pnpm expands the workspace
 * protocol, rather than merely restating the source manifest spelling.
 *
 * 1. Pack @ttsc/graph and extract its published package manifest.
 * 2. Assert the required ttsc peer is a concrete caret range that admits the next
 *    compatible patch.
 * 3. Assert the range rejects its next incompatible semver boundary and ttsc
 *    remains external to the graph package.
 */
export const test_packaged_manifest_declares_upgradeable_ttsc_host = () => {
  const manifest = readPackedManifest();
  const peer = manifest.peerDependencies?.ttsc;
  assert.ok(
    typeof peer === "string",
    "published graph manifest needs a ttsc peer",
  );
  assert.notEqual(
    manifest.peerDependenciesMeta?.ttsc?.optional,
    true,
    "published graph ttsc peer must be required",
  );
  assert.equal(
    manifest.dependencies?.ttsc,
    undefined,
    "published graph must not bundle a second ttsc runtime",
  );
  assertCompatibleCaretRange(peer, "ttsc");
};

function readPackedManifest(): Record<string, any> {
  const packageDir = path.join(TestProject.WORKSPACE_ROOT, "packages", "graph");
  const destination = TestProject.tmpdir("ttsc-graph-pack-");
  const pack = spawnSync("pnpm", ["pack", "--pack-destination", destination], {
    cwd: packageDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(pack.status, 0, `pnpm pack failed:\n${pack.stderr}`);

  const tarball = fs
    .readdirSync(destination)
    .find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "pnpm pack produced no graph tarball");
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
  const match = /^\^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(range);
  assert.ok(
    match,
    `${dependency} must publish a caret range, received ${range}`,
  );
  const [major, minor, patch] = match.slice(1).map(Number);
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
  for (let index = 0; index < left.length; ++index) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}
