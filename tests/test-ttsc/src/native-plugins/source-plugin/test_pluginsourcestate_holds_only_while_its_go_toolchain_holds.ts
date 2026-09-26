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
 * The process keeps its reading of the build environment so each proof need
 * not run `go env`. It was kept under the process's variables alone, so a Go
 * tool replaced at the same path, or a `go env -w` written to the Go
 * environment file, left the old reading in place, and a proof accepted a
 * state built under the old toolchain (samchon/ttsc#1516). The reading is now
 * kept only while the paths it depended on hold their metadata.
 *
 * 1. Point `TTSC_GO_BINARY` at a wrapper of the installed Go and `GOENV` at a
 *    missing file, and read a plugin directory's state.
 * 2. Assert the state holds while nothing changes.
 * 3. Rewrite the wrapper, and assert the old state no longer holds and a fresh
 *    reading differs; then write the environment file, and assert the same.
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
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n\nfunc main() {}\n");
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
