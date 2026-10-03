import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { IPublishedArtifacts } from "../../../../packages/graph/src/model/IPublishedArtifacts";
import {
  artifactsAreStale,
  fingerprintInputs,
} from "../../../../packages/graph/src/model/publishedArtifacts";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies freshness for an already-resolved, empty publication input state.
 *
 * The test supplies a resolved publication with no plugins and no file, whose
 * inputs are a tsconfig and a package manifest, and drives artifactsAreStale
 * through discovery and file transitions without invoking plugin discovery.
 *
 * 1. Write a tsconfig and a manifest and build an explicit empty resolved
 *    publication over them.
 * 2. Require the unchanged state fresh, then require expired and unavailable
 *    discovery to read stale.
 * 3. Edit each declared file in turn, require stale, then re-baseline and require
 *    fresh again.
 *
 * @evidence contracts/testing.md#behavioral-verification artifactsAreStale must report an unchanged empty publication fresh, stale when discovery.isCurrent() returns false or the discovery status is "unavailable", and stale after each of tsconfig.json and package.json is rewritten with different content, then fresh again once the fingerprint is recomputed.
 * @evidence contracts/testing.md#independent-expectations The tsconfig and manifest contents ("{}" versus {"changed":true}) are written by the test and the fresh/stale outcomes are literal booleans; fingerprintInputs supplies only the baseline fingerprint, and the test does not independently certify its hash encoding.
 * @evidence contracts/testing.md#distinguishing-cases Each declared file is edited separately (so an omitted input would stay fresh), and expired and unavailable discovery are separate stale causes against the fresh baseline. Added or deleted files, directories and a non-null publication file are not exercised here.
 * @evidence contracts/testing.md#execution-ownership Runs artifactsAreStale and fingerprintInputs in the test process over files in a temporary directory with an explicit discovery stub; no consumer is installed, no plugin is resolved and no compiler or publisher process starts.
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
