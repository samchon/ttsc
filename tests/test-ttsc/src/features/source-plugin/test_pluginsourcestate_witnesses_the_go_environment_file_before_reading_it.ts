import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceState";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a native Go environment-file race cannot qualify a stale kept
 * reading.
 *
 * A real Node wrapper edits GOENV once immediately after real go env -json has
 * read it. The kept state must equal the explicit fresh reading after that
 * edit; this comparison uses an independent read path, not an independent hash
 * algorithm.
 *
 * 1. Copy the package-owned Go inputs and select a real-Go Node wrapper and empty
 *    GOENV.
 * 2. Place a one-shot edit and marker immediately after the Go environment query.
 * 3. Require the marker and kept/fresh equality, then restore the process
 *    variables.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual pluginSourceState ambient call is compared with pluginSourceState(plugin, {env: process.env}) after the real wrapper writes its one-shot GOENV edit; the marker must exist and is published only after a status-zero Go query.
 * @evidence contracts/testing.md#independent-expectations An independently authored wrapper positions the edit after the selected Go query. The explicit-env call rereads the current file without ambient memo reuse, defining the stable comparison path; it does not supply a second state hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases The explicit local SDK avoids a delegated recheck masking the synchronous owner's race. The marker rejects a fixture that did not make the edit. A repeated ambient call checks the resulting memo; the independent explicit setting still supplies the comparison.
 * @evidence contracts/testing.md#execution-ownership This named source-plugin unit directly imports the authored source API. The platform wrapper synchronously invokes actual Go before editing the owned file. TestProject owns temporary inputs and finally restores every changed process variable's exact presence and value.
 */
export const test_pluginsourcestate_witnesses_the_go_environment_file_before_reading_it =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-goenv-witness-");
    const plugin = path.join(root, "plugin");
    TestProject.copyDirectory(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "test",
        "fixtures",
        "unit",
        "pluginsourcestate_witnesses_the_go_environment_file_before_reading_it",
        "inputs-1",
        "plugin",
      ),
      plugin,
    );
    fs.renameSync(
      path.join(plugin, "main.go.txt"),
      path.join(plugin, "main.go"),
    );
    const goEnvFile = path.join(root, "go-env");
    fs.writeFileSync(goEnvFile, "");
    const edited = path.join(root, "edited");
    const sdk = child_process
      .execFileSync("go", ["env", "GOROOT"], {
        encoding: "utf8",
        env: { ...process.env, GOENV: "off", GOTOOLCHAIN: "local" },
      })
      .trim();
    const realGo = path.join(
      sdk,
      "bin",
      process.platform === "win32" ? "go.exe" : "go",
    );
    const script = path.join(root, "go-wrapper.cjs");
    fs.writeFileSync(
      script,
      [
        'const fs = require("node:fs");',
        'const { spawnSync } = require("node:child_process");',
        "const args = process.argv.slice(2);",
        `const result = spawnSync(${JSON.stringify(realGo)}, args, { stdio: "inherit" });`,
        // The edit lands after `go env` read the file and before its caller
        // can look at the file again.
        `if (result.status === 0 && args[0] === "env" && args.includes("-json") && args.includes("GOENV") && !fs.existsSync(${JSON.stringify(edited)})) {`,
        `  fs.writeFileSync(${JSON.stringify(goEnvFile)}, "GOFLAGS=-tags=ttsc_goenv_witness\\n");`,
        `  fs.writeFileSync(${JSON.stringify(edited)}, "");`,
        "}",
        "process.exit(result.status ?? 1);",
        "",
      ].join("\n"),
    );
    const wrapper =
      process.platform === "win32"
        ? path.join(root, "go.cmd")
        : path.join(root, "go");
    fs.writeFileSync(
      wrapper,
      process.platform === "win32"
        ? `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`
        : `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
    );
    fs.chmodSync(wrapper, 0o755);

    const saved = [
      "TTSC_GO_BINARY",
      "GOENV",
      "GOROOT",
      "GOTOOLCHAIN",
      "GOFLAGS",
    ].map((name) => [name, process.env[name]] as const);
    process.env.TTSC_GO_BINARY = wrapper;
    process.env.GOENV = goEnvFile;
    process.env.GOROOT = sdk;
    process.env.GOTOOLCHAIN = "local";
    delete process.env.GOFLAGS;
    try {
      const kept = pluginSourceState(plugin);
      assert.equal(fs.existsSync(edited), true, "the edit landed");
      assert.equal(
        kept,
        pluginSourceState(plugin, { env: process.env }),
        "the kept reading is the environment file as it now is",
      );
      assert.equal(pluginSourceState(plugin), kept);
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  };
