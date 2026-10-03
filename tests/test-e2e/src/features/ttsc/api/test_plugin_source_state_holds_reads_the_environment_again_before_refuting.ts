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
 * @evidence contracts/testing.md#execution-ownership This E2E-selected entry directly calls built source-state owners over private files and actual Go/toolchain inputs. tests/test-ttsc/src/features/api/test_plugin_source_state_holds_reads_the_environment_again_before_refuting.ts directly calls their authored owners with the exact original input/oracle matrix; supplied-reading composition is separate and does not replace the native inputs.
 * @evidence contracts/e2e.md#necessary-boundary Actual Go environment-file interpretation is an input to the directly called source-state owner. The direct unit preserves its real queries and file transition rather than injected digest equality; no installed consumer or compiler product protocol is needed.
 * @evidence contracts/e2e.md#shared-execution All distinctions share their mutable module and runner setup, retaining fresh observations for changed source/environment premises. Go queries retain their actual cost after direct-unit transfer; tool path and runner lifetime do not certify executable-byte identity, query totals, cache hits or measured savings.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private module and cache/environment-file paths isolate mutations; original effective environment restoration and per-transition proofs remain, and no freshness witness is bypassed or global filesystem operation replaced.
 * @evidence contracts/e2e.md#preserved-coverage All original assertions and fixture mutations remain here and in the exact same-stem direct unit, with historical queue051 execution recorded separately. That prior result is not current prepared survival or duplicate-removal permission. The supplied composer does not substitute for actual file/environment premises.
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
