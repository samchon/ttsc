import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { collectPluginSourceFiles } from "../../../../../packages/ttsc/src/plugin/internal/source/collectPluginSourceFiles";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";
import { pluginSourceStateHolds } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceStateHolds";

/**
 * Verifies a source-state proof trusts a caller-vouched digest and otherwise reads files.
 *
 * A supplied digest is the caller's observation authority. Editing source must
 * refute the old state when the proof reads files, while the supplied old digest
 * deliberately retains that state under an unchanged build environment.
 *
 * 1. Copy the package-owned Go input bytes and verify the sorted selected files.
 * 2. Edit main.go and contrast an own reading with the caller's old digest.
 * 3. Prove the new state with the new digest and refute it with the old digest.
 *
 * @evidence contracts/testing.md#behavioral-verification Direct collectPluginSourceFiles, pluginSourceDigest, pluginSourceState and pluginSourceStateHolds calls preserve all seven original assertions, including selected file order; a source edit must affect the proof's own reading but cannot override a supplied digest.
 * @evidence contracts/testing.md#independent-expectations The authored selected Go paths, pruned node_modules path and explicit appended source bytes establish provenance. Literal boolean expectations follow the supported caller-trust contract; producer state readings are comparison inputs, not snapshots used as an oracle.
 * @evidence contracts/testing.md#distinguishing-cases Own versus supplied digest, old versus new source bytes and new-state acceptance versus old-digest refusal preserve every original assertion. Supplied-reading composition is separately owned by test_plugin_source_state_composes_supplied_build_readings.
 * @evidence contracts/testing.md#execution-ownership This named API unit calls the actual authored source operations over an exact TestProject.copyDirectory copy of package-owned Go fixtures. The build-environment owner may synchronously query installed Go and toolchain files; no Go artifact is built, consumer installed or compiler/product host started. TestProject owns the temporary root.
 */
export function test_plugin_source_state_holds_takes_a_digest_the_caller_vouches_for(): void {
  const source = path.join(TestProject.tmpdir("ttsc-plugin-source-digest-"), "plugin");
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", "fixtures", "e2e",
    "plugin_source_state_holds_takes_a_digest_the_caller_vouches_for", "inputs-1"), source);
  assert.deepEqual(collectPluginSourceFiles(source), [
    path.join(source, "go.mod"),
    path.join(source, "internal", "rules", "rule.go"),
    path.join(source, "main.go"),
  ]);
  const before = pluginSourceDigest(source);
  const state = pluginSourceState(source);
  assert.equal(pluginSourceStateHolds(source, state), true);
  assert.equal(pluginSourceStateHolds(source, state, { sourceDigest: before }), true);
  fs.appendFileSync(path.join(source, "main.go"), "// edited\n");
  assert.equal(pluginSourceStateHolds(source, state), false, "its own read");
  assert.equal(pluginSourceStateHolds(source, state, { sourceDigest: before }), true, "the caller's digest");
  const after = pluginSourceDigest(source);
  const moved = pluginSourceState(source);
  assert.equal(pluginSourceStateHolds(source, moved, { sourceDigest: after }), true);
  assert.equal(pluginSourceStateHolds(source, moved, { sourceDigest: before }), false);
}
