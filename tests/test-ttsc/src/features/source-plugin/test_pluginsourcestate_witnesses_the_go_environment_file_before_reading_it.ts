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
 *
 * @evidence contracts/testing.md#behavioral-verification pluginSourceState retries a real go env read whose wrapper edits GOENV afterward and equals the explicit fresh reading.
 * @evidence contracts/testing.md#independent-expectations The wrapper edit marker proves the race happened; the explicit-env call rereads the now-current state without ambient memo reuse.
 * @evidence contracts/testing.md#distinguishing-cases One post-read environment edit is compared with a fresh stable reading; this is an independent read path, not an independent hash algorithm.
 * @evidence contracts/testing.md#execution-ownership The exported test_pluginsourcestate_witnesses_the_go_environment_file_before_reading_it entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The source-state witness must agree with actual go env output from the installed tool behind a mutable wrapper and GOENV file. The wrapper places a deliberate mutation at the read boundary; in-memory state comparisons cannot prove ordering against that external read. This case builds no native plugin.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The selected wrapper invokes the installed Go metadata tool and is reused for each observation; no plugin compilation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage pluginSourceState retries a real go env read whose wrapper edits GOENV afterward and equals the explicit fresh reading. These assertions stay in test_pluginsourcestate_witnesses_the_go_environment_file_before_reading_it with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
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
