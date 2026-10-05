import assert from "node:assert/strict";

import { selectVersion } from "../../../../packages/playground/src/npm/internal/npmRegistry";

/**
 * Verifies the highest version of the already admitted range/tag intersection.
 *
 * Version selection intersects every requested range or dist-tag before
 * choosing the highest member, so a prerelease admitted by a tag or an explicit
 * range stays selectable while a disjoint intersection selects nothing.
 *
 * 1. Offer release and prerelease versions with latest, same and next tags.
 * 2. Select the highest version for wildcard, tag, exact, prerelease-range and
 *    combined range requests, requiring the literal expected version.
 * 3. Require disjoint tag and range combinations, and an unknown tag, to throw.
 *
 * @evidence contracts/testing.md#behavioral-verification selectVersion is called on one three-version packument for ten authored range/tag lists; seven must return the literal expected version and three (latest+next, an unknown tag, next+^1) must throw. Failures from every row are collected and rethrown together.
 * @evidence contracts/testing.md#independent-expectations The expected versions are hand-written from semver precedence (a bare wildcard skips prereleases, an explicit prerelease range admits them, two different tags have an empty intersection), not computed from selectVersion.
 * @evidence contracts/testing.md#distinguishing-cases A wildcard picks the stable 1.0.0 while the next tag and an exact prerelease pick 2.0.0-beta.1, a prerelease range picks the higher beta.2, a tag combined with a compatible range keeps the tag's version, and disjoint tag/tag, tag/^1 and unknown-tag requests must throw.
 * @evidence contracts/testing.md#execution-ownership Unit-layer entry exported from src/features that calls only the pure selectVersion helper on an in-memory packument; no installer, network or host runs.
 */
export function test_npm_version_selection_retains_admitted_prereleases(): void {
  const metadata = {
    name: "fixture",
    versions: {
      "1.0.0": { name: "fixture", version: "1.0.0" },
      "2.0.0-beta.1": { name: "fixture", version: "2.0.0-beta.1" },
      "2.0.0-beta.2": { name: "fixture", version: "2.0.0-beta.2" },
    },
    "dist-tags": { latest: "1.0.0", next: "2.0.0-beta.1", same: "1.0.0" },
  };
  const rows: { ranges: string[]; expected: string | null }[] = [
    { ranges: ["*"], expected: "1.0.0" },
    { ranges: ["latest"], expected: "1.0.0" },
    { ranges: ["same"], expected: "1.0.0" },
    { ranges: ["next"], expected: "2.0.0-beta.1" },
    { ranges: ["2.0.0-beta.1"], expected: "2.0.0-beta.1" },
    { ranges: [">=2.0.0-beta.1 <2.0.0"], expected: "2.0.0-beta.2" },
    { ranges: ["next", ">=2.0.0-beta.1"], expected: "2.0.0-beta.1" },
    { ranges: ["latest", "next"], expected: null },
    { ranges: ["missing"], expected: null },
    { ranges: ["next", "^1"], expected: null },
  ];
  const failures: unknown[] = [];
  for (const row of rows) {
    try {
      if (row.expected === null)
        assert.throws(() => selectVersion(metadata, row.ranges));
      else assert.equal(selectVersion(metadata, row.ranges), row.expected);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Registry constraint matrix failed");
}
