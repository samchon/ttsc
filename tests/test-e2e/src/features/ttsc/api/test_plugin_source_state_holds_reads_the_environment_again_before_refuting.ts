import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pluginSourceState, pluginSourceStateHolds } from "ttsc/plugin-source";

/**
 * Verifies a plugin source's state proof follows a build environment changed
 * through the Go environment file, so a change no variable carries never makes
 * it refute the state a compile reports (samchon/ttsc#1493).
 *
 * The state a transform reports covers the environment a build is keyed on,
 * which costs a `go env` run and a GOROOT walk to read, so a process keeps its
 * reading under its variables. `go env -w` changes that environment through a
 * file, with no variable moving. A compile keys its binaries on a fresh read
 * and reports the state it built from; a proof holding on to the process's
 * first reading would refute that state on every delivery and recompile
 * forever. The kept reading now holds only while the environment file keeps its
 * metadata (samchon/ttsc#1516), and the proof reads the environment again
 * before it refutes a state all the same.
 *
 * 1. Point `GOENV` at a Go environment file of the test's own, and read a plugin
 *    source's state.
 * 2. Write `GOFLAGS` into that file, moving no variable, and assert the process's
 *    reading follows it to the state a fresh read gives.
 * 3. Assert the proof accepts the fresh state and refutes the old one.
 * @evidence contracts/testing.md#behavioral-verification Actual state observations follow a private GOENV file change without any variable change, accept the fresh producer state and reject the old state.
 * @evidence contracts/testing.md#independent-expectations An explicit private GOENV file and literal GOFLAGS edit establish a real external environment transition; fresh and stale state comparisons distinguish the permitted result.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged initial proof, file-only environment transition, fresh producer agreement, acceptance and stale-state refutation retain all five original assertions.
 * @evidence contracts/testing.md#execution-ownership This named features/api entry executes shipped source-state and cache owners against actual private files and the real Go environment; supplied-reading composition separately executes in test_plugin_source_state_composes_supplied_build_readings.
 * @evidence contracts/e2e.md#necessary-boundary Real Go environment-file interpretation and fresh-versus-process proof observations must agree; injected digest equality cannot establish Go toolchain invalidation.
 * @evidence contracts/e2e.md#shared-execution All distinctions share their mutable module, cache where applicable, one process and installed Go tool in the API environment batch; a changed source/environment premise retains its required fresh observation, with no per-assertion native build or product host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private module and cache/environment-file paths isolate mutations; original effective environment restoration and per-transition proofs remain, and no freshness witness is bypassed or global filesystem operation replaced.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and fixture mutation remains mechanically unchanged here; the new supplied-reading source unit strengthens composition without substituting for these native proof boundaries.
 */
export function test_plugin_source_state_holds_reads_the_environment_again_before_refuting() {
    const root = TestProject.tmpdir("ttsc-plugin-source-goenv-");
    const source = path.join(root, "plugin");
    TestProject.writeFiles(source, FixtureFiles.read("plugin_source_state_holds_reads_the_environment_again_before_refuting/inputs-1", "ttsc"));
    const goenv = path.join(root, "go.env");
    fs.writeFileSync(goenv, "");
    const previous = process.env.GOENV;
    process.env.GOENV = goenv;
    try {
      // 1. The process's reading.
      const before = pluginSourceState(source);
      assert.equal(pluginSourceStateHolds(source, before), true);

      // 2. A change no variable carries.
      fs.writeFileSync(goenv, "GOFLAGS=-tags=ttsc_goenv_probe\n");
      const fresh = pluginSourceState(source, { env: process.env });
      assert.notEqual(fresh, before, "the environment file moved the state");
      assert.equal(
        pluginSourceState(source),
        fresh,
        "the process's reading follows the environment file",
      );

      // 3. The proof accepts what a compile would report now.
      assert.equal(
        pluginSourceStateHolds(source, fresh),
        true,
        "the state a compile would report now holds",
      );
      assert.equal(pluginSourceStateHolds(source, before), false);
    } finally {
      if (previous === undefined) delete process.env.GOENV;
      else process.env.GOENV = previous;
    }
}
