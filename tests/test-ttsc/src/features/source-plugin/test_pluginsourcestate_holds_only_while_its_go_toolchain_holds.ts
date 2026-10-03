import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";
import { pluginSourceStateHolds } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceStateHolds";

/**
 * Verifies source-state proof refutes native Go tool and GOENV changes.
 *
 * Stable process variables cannot authorize reuse after the actual selected
 * wrapper or its formerly absent environment file changes. Source bytes remain
 * fixed while real Go metadata queries observe each transition.
 *
 * 1. Copy the package-owned Go inputs and select a real-Go wrapper and missing GOENV.
 * 2. Preserve two unchanged proofs, rewrite the wrapper and accept only its fresh state.
 * 3. Create GOENV with literal GOFLAGS and require the previous state to fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual pluginSourceState and pluginSourceStateHolds preserve the two unchanged true results, wrapper-edit old false/fresh inequality/new true, and missing-to-present GOENV old false/fresh inequality.
 * @evidence contracts/testing.md#independent-expectations The source tree and variables stay fixed while independently authored wrapper revisions and GOFLAGS=-tags=toolchain_state mutate build dependencies. Literal true/false and changed-state expectations follow provenance validity, not snapshots of computed digest values.
 * @evidence contracts/testing.md#distinguishing-cases Repeated unchanged input is the positive control; an executable rewritten at the same path and an absent GOENV becoming present are separate invalidation causes. Supplied-string composition units do not establish these native observations.
 * @evidence contracts/testing.md#execution-ownership This named source-plugin unit imports the actual source operations directly, copies package-owned Go bytes and starts synchronous real Go metadata queries through the native shell/cmd wrapper. It builds no plugin artifact and installs or starts no product host. TestProject owns private roots; finally restores both TTSC_GO_BINARY and GOENV to their exact previous presence/value. Native preparation and execution are not inferred from the authored body.
 */
export const test_pluginsourcestate_holds_only_while_its_go_toolchain_holds =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-toolchain-state-");
    const plugin = path.join(root, "plugin");
    TestProject.copyDirectory(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "test",
        "fixtures",
        "unit",
        "pluginsourcestate_holds_only_while_its_go_toolchain_holds",
        "inputs-1",
        "plugin",
      ),
      plugin,
    );
    fs.renameSync(path.join(plugin, "main.go.txt"), path.join(plugin, "main.go"));
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
