import { FixtureFiles } from "../../../internal/FixtureFiles";
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
 * @evidence contracts/testing.md#execution-ownership This E2E-selected entry directly calls built source-state owners over private files and actual Go/toolchain inputs. tests/test-ttsc/src/features/api/test_plugin_source_state_holds_takes_a_digest_the_caller_vouches_for.ts directly calls their authored owners with the exact original input/oracle matrix; supplied-reading composition is separate and does not replace the native inputs.
 * @evidence contracts/e2e.md#necessary-boundary Caller-digest proof uses real filesystem and Go environment inputs, but no installed consumer, native compiler artifact or product protocol. Those same native premises belong to the exact direct unit; built import alone does not create a necessary E2E boundary.
 * @evidence contracts/e2e.md#shared-execution All distinctions share their mutable module and runner setup, retaining fresh observations for changed source/environment premises. Go queries retain their actual cost after direct-unit transfer; tool path and runner lifetime do not certify executable-byte identity, query totals, cache hits or measured savings.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private module and cache/environment-file paths isolate mutations; original effective environment restoration and per-transition proofs remain, and no freshness witness is bypassed or global filesystem operation replaced.
 * @evidence contracts/e2e.md#preserved-coverage All original assertions and fixture mutations remain here and in the exact same-stem direct unit, with historical queue051 execution recorded separately. That prior result is not current prepared survival or duplicate-removal permission. The supplied composer does not substitute for actual file/environment premises.
 */
export function test_plugin_source_state_holds_takes_a_digest_the_caller_vouches_for() {
    const source = path.join(
      TestProject.tmpdir("ttsc-plugin-source-digest-"),
      "plugin",
    );
    TestProject.writeFiles(source, FixtureFiles.read("plugin_source_state_holds_takes_a_digest_the_caller_vouches_for/inputs-1", "ttsc"));

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
