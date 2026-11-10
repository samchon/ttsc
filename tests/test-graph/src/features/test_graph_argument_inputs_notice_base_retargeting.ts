import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { fingerprintInputs } from "../../../../packages/graph/src/model/publishedArtifacts";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies consumed argument locators distinguish retargeted directory
 * identity. Equal response bytes can resolve relative arguments under different
 * targets.
 *
 * 1. Fingerprint a response and its argument base through a real directory link.
 * 2. Preserve unchanged reuse and ignore unrelated directory membership.
 * 3. Retarget to an equal-byte response, then edit it; require both transitions.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls maintained fingerprintInputs over real lexical argument inputs, observing unchanged state, equal-byte directory-link retarget and response content changes.
 * @evidence contracts/testing.md#independent-expectations Authored equal response bytes isolate the base identity change; unrelated file creation must not count as argument-directory membership, and literal changed bytes must invalidate the next fingerprint.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged identity and content, unrelated membership, equal-content retarget and a response edit have separate assertions. The native project-input unit owns preserving these locator names across dispatch.
 * @evidence contracts/testing.md#execution-ownership A source unit owns real temporary files and a Node directory junction/symlink without starting a native product. Its finally removes the link before exit-owned directory cleanup; no filesystem API or global is replaced.
 */
export function test_graph_argument_inputs_notice_base_retargeting(): void {
  const root = TestProject.tmpdir("graph-argument-input-alias-");
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  for (const directory of [first, second]) {
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "args.rsp"), "--outDir output\n");
  }
  const alias = path.join(root, "alias");
  fs.symlinkSync(first, alias, "junction");
  try {
    const inputs = {
      directories: [],
      files: [alias, path.join(alias, "args.rsp")],
    };
    const initial = fingerprintInputs(inputs);
    assert.equal(fingerprintInputs(inputs), initial);
    fs.writeFileSync(path.join(first, "unrelated.txt"), "unrelated");
    assert.equal(fingerprintInputs(inputs), initial);
    fs.unlinkSync(alias);
    fs.symlinkSync(second, alias, "junction");
    const retargeted = fingerprintInputs(inputs);
    assert.notEqual(retargeted, initial);
    assert.equal(fingerprintInputs(inputs), retargeted);
    fs.writeFileSync(path.join(second, "args.rsp"), "--outDir changed\n");
    assert.notEqual(fingerprintInputs(inputs), retargeted);
  } finally {
    fs.unlinkSync(alias);
  }
}
