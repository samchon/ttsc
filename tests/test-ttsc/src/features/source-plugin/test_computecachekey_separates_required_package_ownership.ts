import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { computeCacheKey } from "../../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies required package ownership separates cache producer authority.
 *
 * A legacy go build of a library can produce an archive at the binary path.
 * A loader requiring executable ownership must not admit that old artifact
 * without the new producer's actual materialized package check.
 *
 * 1. Reuse the existing host/contributor source-key fixture.
 * 2. Compare legacy, executable and linked ownership requirements.
 * 3. Change one contributor requirement and reverse equivalent requests.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual computeCacheKey preserves repeated legacy identity, separates required ownership from legacy, separates executable versus linked entry and contributor requirements, and preserves a reversed equivalent request population.
 * @evidence contracts/testing.md#independent-expectations A key must distinguish the producer's required package admission, while declaration order does not change the required entry/kind population. Literal request changes establish these expectations independently of hashing internals.
 * @evidence contracts/testing.md#distinguishing-cases Owns no requested ownership, executable entry, linked entry, one linked contributor changing to executable, repeated legacy invocation and reversed identical entry/kind requests.
 * @evidence contracts/testing.md#execution-ownership Calls actual computeCacheKey on a copied existing package-owned fixture with no goBinary, overlays or replacement directive; no Go command, compiler preparation, artifact or native host runs.
 */
export function test_computecachekey_separates_required_package_ownership(): void {
  const root = TestProject.tmpdir("native-ownership-key-");
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT,
    "packages/ttsc/test/fixtures/unit/computecachekey_includes_linked_contributor_sources_order_stably/inputs-1"), root);
  for (const name of ["host", "left", "right"])
    fs.renameSync(path.join(root, name, "value.go.txt"), path.join(root, name, "value.go"));
  const input = { dir: path.join(root, "host"), entry: ".", env: {},
    contributors: [{ name: "left", source: path.join(root, "left") }],
    ttscVersion: "1.0.0", tsgoVersion: "7.0.0-dev" };
  const legacy = computeCacheKey(input);
  assert.equal(computeCacheKey(input), legacy);
  const required = [{ entry: ".", kind: "executable" as const },
    { entry: "./contrib/left", kind: "linked" as const }];
  const admitted = computeCacheKey({ ...input, packageOwnership: required });
  assert.notEqual(admitted, legacy);
  assert.equal(computeCacheKey({ ...input, packageOwnership: [...required].reverse() }), admitted);
  assert.notEqual(computeCacheKey({ ...input, packageOwnership: [
    { entry: ".", kind: "linked" }, required[1]!,
  ] }), admitted);
  assert.notEqual(computeCacheKey({ ...input, packageOwnership: [
    required[0]!, { entry: "./contrib/left", kind: "executable" },
  ] }), admitted);
}
