import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  collectPluginSourceFiles,
  pluginSourceDigest,
  pluginSourceState,
  pluginSourceStateHolds,
} from "ttsc/plugin-source";

/**
 * Verifies a plugin source's state proof takes the sources' digest from a
 * caller that vouches for it, and reads the files itself otherwise.
 *
 * A consumer that re-proves a plugin source on every delivery, as a dev server
 * whose watch cannot vouch for the directory does, paid a read of every source
 * file each time: 169 ms for typia's 622-file module root. It may keep the
 * digest while the metadata of exactly the files the digest reads holds still,
 * which only the consumer can judge, since it owns a clock reference, so the
 * entry exposes the file list and the digest and lets the proof take one.
 *
 * 1. Write a source, and assert the file list is the files the digest reads, in
 *    sorted order, and the state holds with or without the digest handed over.
 * 2. Edit a file, and assert the proof refutes the old state on its own read, and
 *    holds it when handed the old digest, which the proof then trusts.
 * 3. Assert it holds the new state with the new digest, and refutes it with the
 *    old one.
 * @evidence contracts/testing.md#behavioral-verification Actual source-state proof accepts unchanged own/caller digests, rejects changed source under its own read, deliberately trusts a caller-vouched old digest, and distinguishes new versus old supplied digests.
 * @evidence contracts/testing.md#independent-expectations The authored selected/pruned files and explicit source edit establish the digest provenance; positive and negative boolean expectations specify caller trust independently of state values.
 * @evidence contracts/testing.md#distinguishing-cases Own versus supplied digest, before/after source bytes, selected sorted file population and node_modules pruning retain all seven original assertions.
 * @evidence contracts/testing.md#execution-ownership This named features/api entry executes shipped source-state and cache owners against actual private files and the real Go environment; supplied-reading composition separately executes in test_plugin_source_state_composes_supplied_build_readings.
 * @evidence contracts/e2e.md#necessary-boundary The proof composes source authority with a real process build environment; actual supplied-digest proof must retain the native environment premise rather than assuming it stable.
 * @evidence contracts/e2e.md#shared-execution All distinctions share their mutable module, cache where applicable, one process and installed Go tool in the API environment batch; a changed source/environment premise retains its required fresh observation, with no per-assertion native build or product host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private module and cache/environment-file paths isolate mutations; original effective environment restoration and per-transition proofs remain, and no freshness witness is bypassed or global filesystem operation replaced.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and fixture mutation remains mechanically unchanged here; the new supplied-reading source unit strengthens composition without substituting for these native proof boundaries.
 */
export function test_plugin_source_state_holds_takes_a_digest_the_caller_vouches_for() {
    const source = path.join(
      TestProject.tmpdir("ttsc-plugin-source-digest-"),
      "plugin",
    );
    TestProject.writeFiles(source, {
      "go.mod": "module example.com/plugin\n\ngo 1.26\n",
      "internal/rules/rule.go": "package rules\n",
      "main.go": "package main\n\nfunc main() {}\n",
      "node_modules/x/ignored.go": "package x\n",
    });

    // 1. The file list, and the state with and without the digest.
    assert.deepEqual(collectPluginSourceFiles(source), [
      path.join(source, "go.mod"),
      path.join(source, "internal", "rules", "rule.go"),
      path.join(source, "main.go"),
    ]);
    const before = pluginSourceDigest(source);
    const state = pluginSourceState(source);
    assert.equal(pluginSourceStateHolds(source, state), true);
    assert.equal(
      pluginSourceStateHolds(source, state, { sourceDigest: before }),
      true,
    );

    // 2. A digest handed over is trusted, not read again.
    fs.appendFileSync(path.join(source, "main.go"), "// edited\n");
    assert.equal(pluginSourceStateHolds(source, state), false, "its own read");
    assert.equal(
      pluginSourceStateHolds(source, state, { sourceDigest: before }),
      true,
      "the caller's digest",
    );

    // 3. The new state.
    const after = pluginSourceDigest(source);
    const moved = pluginSourceState(source);
    assert.equal(
      pluginSourceStateHolds(source, moved, { sourceDigest: after }),
      true,
    );
    assert.equal(
      pluginSourceStateHolds(source, moved, { sourceDigest: before }),
      false,
    );
}
