import assert from "node:assert/strict";

import { packUnpluginPackage } from "../../internal/packaged-host-contract/packUnpluginPackage";

function readPackedManifest(): Record<string, any> {
  return packUnpluginPackage().manifest;
}

/**
 * Verifies the published `@ttsc/unplugin` manifest declares its external `ttsc`
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
export async function test_packaged_manifest_declares_the_external_ttsc_host(): Promise<void> {
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
  assert.throws(
    () => assertCompatibleCaretRange(peer.slice(1), "ttsc"),
    /caret range/,
    "an exact ttsc pin must not satisfy the upgradeable-host contract",
  );
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
