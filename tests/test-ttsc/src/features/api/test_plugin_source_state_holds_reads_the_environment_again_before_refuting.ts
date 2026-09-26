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
 */
export const test_plugin_source_state_holds_reads_the_environment_again_before_refuting =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-source-goenv-");
    const source = path.join(root, "plugin");
    TestProject.writeFiles(source, {
      "go.mod": "module example.com/plugin\n\ngo 1.26\n",
      "main.go": "package main\n\nfunc main() {}\n",
    });
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
  };
