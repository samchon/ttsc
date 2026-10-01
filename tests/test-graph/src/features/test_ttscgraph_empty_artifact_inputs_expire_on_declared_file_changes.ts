import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  artifactsAreStale,
  fingerprintInputs,
  type IPublishedArtifacts,
} from "../../../../packages/graph/src/model/publishedArtifacts";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies freshness for an already-resolved, empty publication input state.
 *
 * The real discovery and its declared paths belong to the no-publisher E2E
 * case. This predicate unit receives the explicit resolved state as input and
 * owns the configuration and manifest transitions without invoking discovery.
 *
 * 1. Write a tsconfig and a manifest and resolve an explicit empty publication
 *    over them.
 * 2. Require the unchanged state fresh, then require expired and unavailable
 *    discovery to read stale.
 * 3. Edit each declared file in turn, require stale, then re-baseline and require
 *    fresh again.
 *
 * @evidence contracts/testing.md#behavioral-verification artifactsAreStale retains an unchanged empty publication, rejects each independently changed declared file and rejects unavailable or expired discovery authority.
 * @evidence contracts/testing.md#independent-expectations Independently written tsconfig and manifest contents establish unchanged and changed states; fingerprintInputs supplies the baseline but does not supply expected fresh/stale results or independently certify hash encoding.
 * @evidence contracts/testing.md#distinguishing-cases Empty publication reuse contrasts separate tsconfig and manifest edits, expired discovery and unavailable discovery; the real resolved-empty native connection remains in its E2E owner.
 * @evidence contracts/testing.md#execution-ownership This named source-unit entry invokes the actual freshness predicate and filesystem fingerprint owner with explicit unit inputs, without installing a consumer, resolving plugins or starting a compiler or publisher process.
 */
export function test_ttscgraph_empty_artifact_inputs_expire_on_declared_file_changes(): void {
  const root = TestProject.tmpdir("graph-empty-artifact-inputs-");
  try {
    const config = path.join(root, "tsconfig.json");
    const manifest = path.join(root, "package.json");
    fs.writeFileSync(config, "{}");
    fs.writeFileSync(manifest, "{}");
    const inputs = { files: [config, manifest], directories: [] };
    let current = true;
    const resolved: IPublishedArtifacts = {
      file: null,
      inputs,
      fingerprint: fingerprintInputs(inputs),
      discovery: {
        status: "resolved",
        plugins: [],
        isCurrent: () => current,
      },
    };
    assert.equal(artifactsAreStale(resolved), false);
    current = false;
    assert.equal(artifactsAreStale(resolved), true);
    current = true;
    assert.equal(
      artifactsAreStale({
        ...resolved,
        discovery: { ...resolved.discovery!, status: "unavailable" },
      }),
      true,
    );
    for (const file of [config, manifest]) {
      fs.writeFileSync(file, '{"changed":true}');
      assert.equal(artifactsAreStale(resolved), true, `${file} must expire reuse`);
      resolved.fingerprint = fingerprintInputs(inputs);
      assert.equal(artifactsAreStale(resolved), false, `${file} updated baseline`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
