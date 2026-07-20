import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Pack `@ttsc/unplugin` exactly as it would be published and return the packed
 * `package.json`.
 *
 * `pnpm pack` is offline and deterministic, and it rewrites `workspace:^` to
 * the concrete caret range a real consumer's package manager sees — the
 * published dependency contract. Reading that manifest (rather than the source
 * one) is what proves the contract a clean install would receive, without a
 * network install.
 */
function readPackedManifest(): Record<string, any> {
  const unpluginDir = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "unplugin",
  );
  const dest = TestProject.tmpdir("ttsc-unplugin-pack-");
  const pack = spawnSync("pnpm", ["pack", "--pack-destination", dest], {
    cwd: unpluginDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(pack.status, 0, `pnpm pack failed:\n${pack.stderr}`);

  const tarball = fs.readdirSync(dest).find((name) => name.endsWith(".tgz"));
  assert.ok(tarball, "pnpm pack produced no tarball");

  // Extract just the manifest to stdout; `tar -O` is available cross-platform
  // (bsdtar on Windows, GNU tar elsewhere) and avoids a tar library. Run with
  // `cwd: dest` and a relative tarball name so a Windows drive-letter colon in
  // the path is never mistaken for a remote `host:path` spec by GNU tar.
  const show = spawnSync("tar", ["-xzOf", tarball, "package/package.json"], {
    cwd: dest,
    encoding: "utf8",
  });
  assert.equal(show.status, 0, `tar extraction failed:\n${show.stderr}`);
  return JSON.parse(show.stdout);
}

/**
 * Asserts the published `@ttsc/unplugin` manifest declares its external `ttsc`
 * host in the runtime dependency contract.
 *
 * The package imports `ttsc` at runtime but the Rollup build leaves it
 * external. With `ttsc` declared only under `devDependencies`, a clean install
 * succeeded yet the first import failed with `Cannot find module 'ttsc'`. The
 * host must be a required `peerDependency` so a package manager installs,
 * validates, or warns about it — while staying external (never a bundled second
 * compiler copy).
 *
 * 1. Pack the package as it would be published (rewriting `workspace:^`).
 * 2. Assert `ttsc` is declared as a required peer dependency with a concrete caret
 *    range — no leaked `workspace:` protocol or exact pin a consumer cannot
 *    upgrade through.
 * 3. Assert `ttsc` is not also a bundled runtime `dependencies` entry.
 */
async function assertPackedManifestDeclaresTtscHost(): Promise<void> {
  const manifest = readPackedManifest();

  const peer = manifest.peerDependencies?.ttsc;
  assert.ok(
    typeof peer === "string" && peer.length !== 0,
    "published manifest must declare ttsc as a peer dependency host",
  );
  assert.doesNotMatch(
    peer,
    /^workspace:/,
    "workspace protocol leaked into the published ttsc spec",
  );
  assertCompatibleCaretRange(peer, "ttsc");
  assert.notEqual(
    manifest.peerDependenciesMeta?.ttsc?.optional,
    true,
    "the ttsc host must be required, not optional",
  );
  assert.equal(
    manifest.dependencies?.ttsc,
    undefined,
    "ttsc must stay external, not a bundled runtime dependency",
  );
}

function assertCompatibleCaretRange(range: string, dependency: string): void {
  const match =
    /^\^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
      range,
    );
  assert.ok(
    match,
    `${dependency} must publish a concrete caret range, received ${JSON.stringify(range)}`,
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
    assert.equal(
      accepts([major, minor, patch + 1]),
      true,
      `${dependency} must admit its next compatible patch`,
    );
  }
  assert.equal(
    accepts(upper),
    false,
    `${dependency} must reject its next incompatible boundary`,
  );
}

function compareVersions(
  left: [number, number, number],
  right: [number, number, number],
): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export { assertPackedManifestDeclaresTtscHost };
