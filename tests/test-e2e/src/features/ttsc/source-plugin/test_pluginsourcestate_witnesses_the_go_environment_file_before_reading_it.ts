import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import path from "node:path";

import { pluginSourceState } from "../../../../../../packages/ttsc/lib/plugin/internal/source/pluginSourceState.js";

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
 * @evidence contracts/testing.md#behavioral-verification After a successful real go env query, the wrapper edits GOENV once; the marker is present and the kept state equals an explicit fresh reading. These assertions do not count internal retries.
 * @evidence contracts/testing.md#independent-expectations The marker is written only after status0 for the relevant env query, distinguishing an actual successful read followed by the authored edit from a failed Go query. The explicit-env call provides a fresh comparison path, not an independent fingerprint algorithm or literal GOFLAGS-value oracle.
 * @evidence contracts/testing.md#distinguishing-cases One post-read environment edit is compared with a fresh stable reading; this is an independent read path, not an independent hash algorithm.
 * @evidence contracts/testing.md#execution-ownership This legacy features/ttsc/source-plugin entry directly calls the owning state operation. Its exact source-unit counterpart is tests/test-ttsc/src/features/source-plugin/test_pluginsourcestate_witnesses_the_go_environment_file_before_reading_it.ts, authored with actual Go/Node wrapper inputs and the status0 marker guard. That body remains unexecuted; this donor is retained until actual selected survivor coverage is established.
 * @evidence contracts/e2e.md#necessary-boundary Real Go and a Node wrapper supply native read-order inputs to the direct owning operation; no shipped ttsc consumer, plugin compilation or product-host protocol is involved. The source unit preserves that actual preparation rather than replacing it with in-memory digest arithmetic. Its existence does not certify native transport or runtime coverage.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The selected wrapper invokes the installed Go metadata tool and is reused for each observation; no plugin compilation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before preparation. The first TTSC_GO_BINARY/GOENV writes occur inside try and finally restores exact prior absence or values. Empty GOENV and a private absent marker preserve the one-shot transition; the fresh state uses an explicit environment rather than the ambient memo path. Returned synchronous commands are not arbitrary descendant joins.
 * @evidence contracts/e2e.md#preserved-coverage The exact source-unit counterpart in c0835b1da320cc965d4c7fbc2f057998a93373aa preserves the original plugin bytes, real Go query, Node one-shot edit, marker/equality expectations and both environment restores, adding the successful-query guard. It is authored, not executed survival proof; original donor observations remain until actual survivor coverage permits removal.
 */
export const test_pluginsourcestate_witnesses_the_go_environment_file_before_reading_it =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-goenv-witness-");
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
        `const { spawnSync } = require(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
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

    const saved = {
      binary: process.env.TTSC_GO_BINARY,
      goenv: process.env.GOENV,
    };
    try {
      process.env.TTSC_GO_BINARY = wrapper;
      process.env.GOENV = goEnvFile;
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
