import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceState.js";

/**
 * Verifies a kept build-environment reading witnesses the Go environment file
 * before `go env` reads it, so an edit landing right after the read is never
 * taken for the state that was read.
 *
 * The process keeps its reading while the metadata of the paths it depended on
 * holds (samchon/ttsc#1516). The Go environment file's metadata was taken only
 * after `go env` had already read it, so an edit between the two was recorded
 * as the witnessed state while the reading held the old content, and the stale
 * reading was kept as proven. The file is now witnessed before the read that
 * depends on it.
 *
 * 1. Point `TTSC_GO_BINARY` at a wrapper of the installed Go that, once, rewrites
 *    the Go environment file right after `go env -json` read it.
 * 2. Take the process's reading of a plugin directory's state.
 * 3. Assert it equals a fresh reading of the file as it now is.
 */
export const test_pluginsourcestate_witnesses_the_go_environment_file_before_reading_it =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-goenv-witness-");
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
    const goEnvFile = path.join(root, "go-env");
    fs.writeFileSync(goEnvFile, "");
    const edited = path.join(root, "edited");
    const realGo = path.join(
      child_process
        .execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" })
        .trim(),
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
        `if (args[0] === "env" && args.includes("-json") && args.includes("GOENV") && !fs.existsSync(${JSON.stringify(edited)})) {`,
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

    const saved = {
      binary: process.env.TTSC_GO_BINARY,
      goenv: process.env.GOENV,
    };
    process.env.TTSC_GO_BINARY = wrapper;
    process.env.GOENV = goEnvFile;
    try {
      const kept = pluginSourceState(plugin);
      assert.equal(fs.existsSync(edited), true, "the edit landed");
      assert.equal(
        kept,
        pluginSourceState(plugin, { env: process.env }),
        "the kept reading is the environment file as it now is",
      );
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
