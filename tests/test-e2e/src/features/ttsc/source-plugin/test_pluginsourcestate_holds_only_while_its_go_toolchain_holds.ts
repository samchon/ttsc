import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceState.js";
import { pluginSourceStateHolds } from "../../../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceStateHolds.js";

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
 * @evidence contracts/testing.md#execution-ownership This legacy features/ttsc/source-plugin entry directly calls the owning source-state operations with real Go metadata inputs. Its direct source counterpart is tests/test-ttsc/src/features/source-plugin/test_pluginsourcestate_holds_only_while_its_go_toolchain_holds.ts; that authored body preserves the seven original state/refutation observations but remains unexecuted. This donor is retained until actual selected survivor coverage is established.
 * @evidence contracts/e2e.md#necessary-boundary The installed Go wrapper and GOENV are native inputs to direct state operations, not a shipped ttsc installation, native plugin build or product-host protocol. They do not make this portable owning-operation contribution require E2E. The source unit retains actual Go preparation and both metadata mutations; its existence is not runtime or native transport certification.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The selected wrapper invokes the installed Go metadata tool and is reused for each observation; no plugin compilation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before native preparation. The first TTSC_GO_BINARY/GOENV writes occur inside try and finally restores exact prior absence or values. Sequential unchanged/wrapper-rewrite/GOENV-creation states share one source and tool, preserving invalidation without deleting memo state. Synchronous metadata returns are not arbitrary descendant joins or loaded-image certification.
 * @evidence contracts/e2e.md#preserved-coverage The exact authored source-unit address above preserves unchanged true twice, rewrite false/fresh different/true, GOENV creation false/fresh different and both environment restores with original fixture bytes. Its c0835b1da320cc965d4c7fbc2f057998a93373aa body delivery is not execution proof; donor inputs and assertions remain until actual survivor execution and coverage permit removal.
 */
export const test_pluginsourcestate_holds_only_while_its_go_toolchain_holds =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-toolchain-state-");
    TestProject.retainTemporaryDirectory(root);
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
    try {
      process.env.TTSC_GO_BINARY = wrapper;
      process.env.GOENV = goEnvFile;
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
