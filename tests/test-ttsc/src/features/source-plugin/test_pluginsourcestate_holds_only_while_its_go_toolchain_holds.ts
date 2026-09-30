import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceState.js";
import { pluginSourceStateHolds } from "../../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceStateHolds.js";

/**
 * Verifies a plugin source's state stops holding, within one process, when the
 * Go toolchain behind it changes without any variable changing.
 *
 * The process keeps its reading of the build environment so each proof need not
 * run `go env`. It was kept under the process's variables alone, so a Go tool
 * replaced at the same path, or a `go env -w` written to the Go environment
 * file, left the old reading in place, and a proof accepted a state built under
 * the old toolchain (samchon/ttsc#1516). The reading is now kept only while the
 * paths it depended on hold their metadata.
 *
 * 1. Point `TTSC_GO_BINARY` at a wrapper of the installed Go and `GOENV` at a
 *    missing file, and read a plugin directory's state.
 * 2. Assert the state holds while nothing changes.
 * 3. Rewrite the wrapper, and assert the old state no longer holds and a fresh
 *    reading differs; then write the environment file, and assert the same.
 *
 * @evidence contracts/testing.md#behavioral-verification pluginSourceStateHolds stays true unchanged, then false after rewriting the real-Go wrapper and after creating GOENV; fresh states differ.
 * @evidence contracts/testing.md#independent-expectations The wrapper and GOENV are deliberately mutated while process variables remain fixed, so the old provenance must cease holding.
 * @evidence contracts/testing.md#distinguishing-cases Repeated unchanged state is the positive control, followed by executable mutation and missing-to-present environment file transitions.
 * @evidence contracts/testing.md#execution-ownership The exported test_pluginsourcestate_holds_only_while_its_go_toolchain_holds entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The source-state witness must agree with actual go env output from the installed tool behind a mutable wrapper and GOENV file. The executable and GOENV mutations occur between reads while process variables stay fixed; direct digest arithmetic cannot prove the subsequent actual Go observation stops reusing the earlier reading. This case builds no native plugin.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The selected wrapper invokes the installed Go metadata tool and is reused for each observation; no plugin compilation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage pluginSourceStateHolds stays true unchanged, then false after rewriting the real-Go wrapper and after creating GOENV; fresh states differ. These assertions stay in test_pluginsourcestate_holds_only_while_its_go_toolchain_holds with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_pluginsourcestate_holds_only_while_its_go_toolchain_holds =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-toolchain-state-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    fs.writeFileSync(
      path.join(plugin, "main.go"),
      "package main\n\nfunc main() {}\n",
    );
    const realGo = child_process
      .execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" })
      .trim();
    const goBinary = path.join(
      realGo,
      "bin",
      process.platform === "win32" ? "go.exe" : "go",
    );
    const wrapper = path.join(
      root,
      "tools",
      process.platform === "win32" ? "go.cmd" : "go",
    );
    const writeWrapper = (revision: string): void => {
      fs.mkdirSync(path.dirname(wrapper), { recursive: true });
      fs.writeFileSync(
        wrapper,
        process.platform === "win32"
          ? `@echo off\r\nrem ${revision}\r\n"${goBinary}" %*\r\n`
          : `#!/bin/sh\n# ${revision}\nexec "${goBinary}" "$@"\n`,
      );
      fs.chmodSync(wrapper, 0o755);
    };
    writeWrapper("first");
    const goEnvFile = path.join(root, "go-env");

    const saved = {
      binary: process.env.TTSC_GO_BINARY,
      goenv: process.env.GOENV,
    };
    process.env.TTSC_GO_BINARY = wrapper;
    process.env.GOENV = goEnvFile;
    try {
      const first = pluginSourceState(plugin);
      assert.equal(pluginSourceStateHolds(plugin, first), true);
      assert.equal(pluginSourceStateHolds(plugin, first), true);

      writeWrapper("second");
      assert.equal(
        pluginSourceStateHolds(plugin, first),
        false,
        "a Go tool rewritten in place refutes the old state",
      );
      const second = pluginSourceState(plugin);
      assert.notEqual(second, first);
      assert.equal(pluginSourceStateHolds(plugin, second), true);

      fs.writeFileSync(goEnvFile, "GOFLAGS=-tags=toolchain_state\n");
      assert.equal(
        pluginSourceStateHolds(plugin, second),
        false,
        "a `go env -w` setting refutes the old state",
      );
      assert.notEqual(pluginSourceState(plugin), second);
    } finally {
      for (const [name, value] of [
        ["TTSC_GO_BINARY", saved.binary],
        ["GOENV", saved.goenv],
      ] as const) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  };
