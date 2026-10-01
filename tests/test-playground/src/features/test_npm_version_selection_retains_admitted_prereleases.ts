import assert from "node:assert/strict";
import { selectVersion } from "../../../../packages/playground/src/npm/internal/npmRegistry";
/**
 * Verifies the highest version of the already admitted range/tag intersection.
 *
 * @evidence contracts/testing.md#behavioral-verification Every ten-row registry constraint is evaluated even after another row fails.
 * @evidence contracts/testing.md#independent-expectations The version records and expected tag/range choices are literals authored from semver precedence and exact-tag intersection.
 * @evidence contracts/testing.md#distinguishing-cases Stable defaults, exact prereleases, prerelease ranges, same/different tags, missing tags and incompatible intersections distinguish admission from final ranking.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry executes the owning source operations in this test process, without installing a consumer, building a native producer or fabricating process protocol replies.
 */

export function test_npm_version_selection_retains_admitted_prereleases(): void {
  const metadata = { name: "fixture", versions: { "1.0.0": { name: "fixture", version: "1.0.0" }, "2.0.0-beta.1": { name: "fixture", version: "2.0.0-beta.1" }, "2.0.0-beta.2": { name: "fixture", version: "2.0.0-beta.2" } }, "dist-tags": { latest: "1.0.0", next: "2.0.0-beta.1", same: "1.0.0" } };
  const rows: { ranges: string[]; expected: string | null }[] = [
    { ranges: ["*"], expected: "1.0.0" }, { ranges: ["latest"], expected: "1.0.0" },
    { ranges: ["same"], expected: "1.0.0" }, { ranges: ["next"], expected: "2.0.0-beta.1" },
    { ranges: ["2.0.0-beta.1"], expected: "2.0.0-beta.1" },
    { ranges: [">=2.0.0-beta.1 <2.0.0"], expected: "2.0.0-beta.2" },
    { ranges: ["next", ">=2.0.0-beta.1"], expected: "2.0.0-beta.1" },
    { ranges: ["latest", "next"], expected: null }, { ranges: ["missing"], expected: null },
    { ranges: ["next", "^1"], expected: null },
  ];
  const failures: unknown[] = [];
  for (const row of rows) {
    try {
      if (row.expected === null) assert.throws(() => selectVersion(metadata, row.ranges));
      else assert.equal(selectVersion(metadata, row.ranges), row.expected);
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Registry constraint matrix failed");
}
