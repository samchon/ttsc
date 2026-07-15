import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
 * 1. Build launcher, cwd, and tsconfig paths containing spaces and `&`.
 * 2. Assert only the `.cmd`/`.bat` executables carry `windowsVerbatimArguments`.
 * 3. On Windows, spawn a recording `.cmd` and `.bat` with the exact executable
 *    options and confirm the recorded args equal the expected LSP args.
 * 4. Spawn the same command without the flag and confirm the shim does not receive
 *    those args.
 */
export const test_vscode_server_launch_command_spawns_windows_command_shim =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const serverResolution = path.join(
      repo,
      "packages",
      "vscode",
      "src",
      "serverResolution.ts",
    );
    const script = `
    import { pathToFileURL } from "node:url";
    import fs from "node:fs";
    import os from "node:os";
    import path from "node:path";
    import { spawnSync } from "node:child_process";

    const mod = await import(pathToFileURL(${JSON.stringify(
      serverResolution,
    )}).href);

    const base = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-vscode-launch-"));
    const dir = path.join(base, "Tools & SDK (x86)");
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
    const expectedArgs = build(path.join(cwd, "server.exe")).args;

    const recorder = (record) =>
      [
        "@echo off",
        "setlocal enabledelayedexpansion",
        'break>"' + record + '"',
        ":loop",
        'if "%~1"=="" goto :done',
        'set "arg=%~1"',
        '>>"' + record + '" echo(!arg!',
        "shift",
        "goto :loop",
        ":done",
        "endlocal",
        "exit /b 0",
        "",
      ].join("\\r\\n");
    const readRecord = (record) =>
      fs.existsSync(record)
        ? fs.readFileSync(record, "utf8").split(/\\r?\\n/).filter(Boolean)
        : null;
    const runShim = (ext) => {
      const launcher = path.join(dir, "server." + ext);
      const record = path.join(dir, "record-" + ext + ".txt");
      fs.writeFileSync(launcher, recorder(record));
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
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch {}
    console.log(JSON.stringify({
      platform: process.platform,
      shape: shape,
      expectedArgs: expectedArgs,
      spawn: spawn,
    }));
  `;
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-transform-types",
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
      assert.equal(parsed.spawn, null);
      return;
    }
    const spawnResults = parsed.spawn;
    assert.ok(spawnResults);
    for (const ext of ["cmd", "bat"] as const) {
      const shim = spawnResults[ext];
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
