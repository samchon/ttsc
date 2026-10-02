import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
import path from "node:path";

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
 * @evidence contracts/testing.md#execution-ownership This named os-boundaries/ttscserver entry runs actual .cmd/.bat argv transport in the sole installation matrix; portable executable option decisions are separately owned by source units.
 * @evidence contracts/e2e.md#necessary-boundary The packaged command must cross actual child argv and command-shell interpretation before its recorded arguments are asserted; direct command construction cannot establish that transport.
 * @evidence contracts/e2e.md#shared-execution One fixture supplies the recording command and all arguments in this named case. Remaining .cmd/.bat or default-command lifetimes observe distinct execution entrypoints; no compiler, Go plugin build or consumer installation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A parent TestProject-owned root and child-only environment separate recording output; the child removes its fixture in finally even if command construction or spawning throws, and parent exit cleanup retains ownership if the child cannot finish.
 * @evidence contracts/e2e.md#preserved-coverage The launch-command child preserves server argv through recording .cmd/.bat shims, with verbatim options only for command shims. Original .cmd/.bat positive and missing-verbatim negative argv assertions remain here; JS/native/cmd launch decisions also retain their direct source unit owner test_vscode_server_launch_command_uses_command_mode.
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
    const script = `
    import { pathToFileURL } from "node:url";
    import fs from "node:fs";
    import os from "node:os";
    import path from "node:path";
    import { spawnSync } from "node:child_process";

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
      const verbatimRecord = readRecord(record);
      if (fs.existsSync(record)) fs.rmSync(record);
      const plainOptions = Object.assign({}, exec.options);
      delete plainOptions.windowsVerbatimArguments;
      const plain = spawnSync(exec.command, exec.args, Object.assign(
        {},
        plainOptions,
        { encoding: "utf8", windowsHide: true },
      ));
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
      fs.rmSync(base, { recursive: true, force: true });
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
