import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { TestProject } from "../../../../../../utils/src/TestProject";

const { spawnSync } = E2eProcessTrace;

/**
 * Verifies VS Code `ttsc.serverPath` launches a Windows `.cmd`/`.bat` shim.
 *
 * `createServerLaunchCommand` encodes a Windows command shim as one fully
 * quoted `cmd.exe /d /s /c` payload, but without `windowsVerbatimArguments`
 * Node escapes that payload a second time and cmd.exe rejects it before the
 * language server starts. This pins the fix at the `createServerExecutable`
 * boundary (the exact command/args/options the extension hands
 * `vscode-languageclient`), not just the quoted string: the `.cmd`/`.bat` shim
 * must receive every LSP argument verbatim, while the negative twin — the same
 * command without the flag — must not.
 *
 * 1. Build launcher, cwd, and tsconfig paths containing spaces, `&`, `%`, and `^`.
 * 2. Assert only the `.cmd`/`.bat` executables carry `windowsVerbatimArguments`.
 * 3. On Windows, spawn a recording `.cmd` and `.bat` with the exact executable
 *    options and confirm the recorded args equal the expected LSP args.
 * 4. Spawn the same command without the flag and confirm the shim does not receive
 *    those args.
 *
 * @evidence contracts/testing.md#behavioral-verification The launch-command child preserves server argv through recording .cmd/.bat shims, with verbatim options only for command shims.
 * @evidence contracts/testing.md#independent-expectations Literal stdio, cwd, suppression, namespace and tsconfig flags form expected argv independently of createServerExecutable; metacharacter-bearing paths and real cmd.exe interpretation distinguish quoting errors. The separately tested command namespace helper supplies only its prefix.
 * @evidence contracts/testing.md#distinguishing-cases 1. Build launcher, cwd, and tsconfig paths containing spaces, `&`, `%`, and `^`. 2. Assert only the `.cmd`/`.bat` executables carry `windowsVerbatimArguments`. 3. On Windows, spawn a recording `.cmd` and `.bat` with the exact executable options and confirm the recorded args equal the expected LSP args. 4. Spawn the same command without the flag and confirm the shim does not receive those args.
 * @evidence contracts/testing.md#execution-ownership A parent Node child imports workspace serverResolution source and invokes actual .cmd/.bat transport. Installation caller does not turn this into packaged VSCode, language-client or LSP server proof. Controlled command decisions and kernel argv observations are distinct.
 * @evidence contracts/e2e.md#necessary-boundary Actual cmd interpretation can corrupt argv despite correct constructed strings. Workspace createServerExecutable must cross that real shell/recorder boundary; no fake server reply or packaged extension behavior is asserted.
 * @evidence contracts/e2e.md#shared-execution One parent Node plus four .cmd/.bat invocations and positive or possible negative recorder Nodes are distinct starts, not one child. The same command without verbatim options is an intended negative profile, not an extra preparation family. Actual process cost remains unmeasured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Parent tracked root is retained before child preparation; child-only sentinel/result paths isolate recording. Actual positive and negative launch error/signal are checked independently of intended nonzero/incorrect argv. Synchronous return does not certify descendants, so child finally withholds input deletion.
 * @evidence contracts/e2e.md#preserved-coverage Original cmd/bat true versus JS/native null, positive status0/exact argv and non-verbatim differing argv remain. Namespace prefix comes from the same helper and is not an independent value oracle. No portable source-unit or installed-host survival is certified by this case.
 */
export const case_vscode_server_launch_command_spawns_windows_command_shim =
  () => {
    if (process.platform !== "win32") return;
    const repo = TestProject.WORKSPACE_ROOT;
    const serverResolution = path.join(
      repo,
      "packages",
      "vscode",
      "src",
      "serverResolution.ts",
    );
    const fixture = TestProject.tmpdir("ttsc-vscode-launch-");
    TestProject.retainTemporaryDirectory(
      fixture,
      "Windows server shim has no descendant join acknowledgement",
    );
    const script = `
    import { pathToFileURL } from "node:url";
    import fs from "node:fs";
    import os from "node:os";
    import path from "node:path";
    import processTrace from ${JSON.stringify(pathToFileURL(E2eProcessTrace.runtimePath).href)};
    const { spawnSync } = processTrace;

    const mod = await import(pathToFileURL(${JSON.stringify(
      serverResolution,
    )}).href);

    const base = ${JSON.stringify(fixture)};
    try {
    const recorder = path.join(base, "record-argv.cjs");
    const sentinel = "TTSC_VSCODE_PERCENT_SENTINEL";
    process.env[sentinel] = "EXPANDED";
    process.env.TTSC_VSCODE_TEST_NODE = process.execPath;
    process.env.TTSC_VSCODE_TEST_RECORDER = recorder;
    fs.writeFileSync(
      recorder,
      [
        'const fs = require("node:fs");',
        'fs.writeFileSync(process.env.TTSC_VSCODE_TEST_RECORD, JSON.stringify(process.argv.slice(2)));',
        "",
      ].join("\\n"),
    );
    const dir = path.join(
      base,
      "Tools & SDK (x86) 100% %" + sentinel + "% ^",
    );
    const cwd = path.join(dir, "my project");
    fs.mkdirSync(cwd, { recursive: true });
    const tsconfig = path.join(cwd, "tsconfig.json");
    fs.writeFileSync(tsconfig, "{}");

    const candidate = { cwd: cwd, resolveFrom: cwd, tsconfig: tsconfig };
    const env = Object.assign({}, process.env, {
      ComSpec: process.env.ComSpec || "cmd.exe",
    });
    const build = (launcher) =>
      mod.createServerExecutable(launcher, candidate, "win32", env);
    const verbatimOf = (launcher) =>
      build(launcher).options.windowsVerbatimArguments ?? null;

    const shape = {
      cmd: verbatimOf(path.join(dir, "server.cmd")),
      bat: verbatimOf(path.join(dir, "server.bat")),
      js: verbatimOf(path.join(cwd, "server.js")),
      native: verbatimOf(path.join(cwd, "server.exe")),
    };
    const expectedArgs = [
      "--stdio",
      "--cwd=" + cwd,
      "--suppress-execute-command-ids=ttsc.lint.fixAll,ttsc.format.document",
      "--execute-command-id-prefix=" + mod.executeCommandIDPrefix(cwd),
      "--tsconfig=" + tsconfig,
    ];

    const readRecord = (record) =>
      fs.existsSync(record)
        ? JSON.parse(fs.readFileSync(record, "utf8"))
        : null;
    const runShim = (ext) => {
      const launcher = path.join(dir, "server." + ext);
      const record = path.join(base, "record-" + ext + ".json");
      process.env.TTSC_VSCODE_TEST_RECORD = record;
      fs.writeFileSync(
        launcher,
        [
          "@echo off",
          '"%TTSC_VSCODE_TEST_NODE%" "%TTSC_VSCODE_TEST_RECORDER%" %*',
          "",
        ].join("\\r\\n"),
      );
      const exec = build(launcher);
      if (fs.existsSync(record)) fs.rmSync(record);
      const verbatim = spawnSync(exec.command, exec.args, Object.assign(
        {},
        exec.options,
        { encoding: "utf8", windowsHide: true },
      ));
      if (verbatim.error) throw verbatim.error;
      if (verbatim.signal !== null) throw new Error("verbatim shim terminated by signal");
      const verbatimRecord = readRecord(record);
      if (fs.existsSync(record)) fs.rmSync(record);
      const plainOptions = Object.assign({}, exec.options);
      delete plainOptions.windowsVerbatimArguments;
      const plain = spawnSync(exec.command, exec.args, Object.assign(
        {},
        plainOptions,
        { encoding: "utf8", windowsHide: true },
      ));
      if (plain.error) throw plain.error;
      if (plain.signal !== null) throw new Error("non-verbatim shim terminated by signal");
      const plainRecord = readRecord(record);
      return {
        verbatimStatus: verbatim.status,
        verbatimRecord: verbatimRecord,
        plainRecord: plainRecord,
      };
    };

    const isWin = process.platform === "win32";
    const spawn = isWin ? { cmd: runShim("cmd"), bat: runShim("bat") } : null;
    console.log(JSON.stringify({
      platform: process.platform,
      shape: shape,
      expectedArgs: expectedArgs,
      spawn: spawn,
    }));
    } finally {
      // Parent retains actual fixture inputs pending descendant closure.
    }
  `;
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        script,
      ],
      {
        cwd: repo,
        encoding: "utf8",
      },
    );
    assert.equal(
      result.error,
      undefined,
      "Windows server observer launch error",
    );
    assert.equal(
      result.signal,
      null,
      "Windows server observer terminated by signal",
    );
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as {
      platform: string;
      shape: {
        bat: boolean | null;
        cmd: boolean | null;
        js: boolean | null;
        native: boolean | null;
      };
      expectedArgs: string[];
      spawn: null | {
        bat: ShimResult;
        cmd: ShimResult;
      };
    };

    // Only the pre-quoted Windows command shim requests verbatim spawn
    // arguments; JS and native launchers keep Node's default array escaping.
    assert.equal(parsed.shape.cmd, true);
    assert.equal(parsed.shape.bat, true);
    assert.equal(parsed.shape.js, null);
    assert.equal(parsed.shape.native, null);

    if (parsed.platform !== "win32") {
      console.log(
        "Skipped Windows command-shim child-argv assertions: cmd.exe is unavailable.",
      );
      assert.equal(parsed.spawn, null);
      return;
    }
    const spawnResults = parsed.spawn;
    assert.ok(spawnResults);
    for (const ext of ["cmd", "bat"] as const) {
      const shim: ShimResult = spawnResults[ext];
      assert.equal(shim.verbatimStatus, 0, `verbatim ${ext} exit status`);
      assert.deepEqual(
        shim.verbatimRecord,
        parsed.expectedArgs,
        `verbatim ${ext} recorded args`,
      );
      assert.notDeepEqual(
        shim.plainRecord,
        parsed.expectedArgs,
        `non-verbatim ${ext} must not deliver the LSP arguments`,
      );
    }
  };

type ShimResult = {
  plainRecord: string[] | null;
  verbatimRecord: string[] | null;
  verbatimStatus: number | null;
};
