import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Verifies VS Code install script uses a Windows command shim.
 *
 * Windows commonly exposes VS Code's CLI as `code.cmd`, which direct
 * `spawnSync("code")` does not reliably resolve. The npm `ttsc-vscode` shim
 * must route through `cmd.exe` on Windows while keeping direct `code` execution
 * on POSIX.
 *
 * 1. Require the packaged install helper without running its CLI entrypoint.
 * 2. Build POSIX and Windows command shapes, including metacharacters.
 * 3. Assert Windows carries quoted argv fragments through its environment.
 * 4. On Windows, spawn a recording `code.cmd` and compare its exact argv.
 */
export const test_vscode_install_script_uses_windows_command_shim = () => {
  const repo = TestProject.WORKSPACE_ROOT;
  const requireFromRepo = createRequire(path.join(repo, "package.json"));
  const mod = requireFromRepo(
    path.join(repo, "packages", "vscode", "bin", "install.js"),
  ) as {
    createCodeCommand: (
      args: string[],
      platform?: NodeJS.Platform,
      env?: NodeJS.ProcessEnv,
      deps?: {
        existsSync?: (path: string) => boolean;
        spawnSync?: () => { error?: Error; stdout?: string };
      },
    ) => {
      args: string[];
      command: string;
      options: {
        env?: NodeJS.ProcessEnv;
        windowsVerbatimArguments?: boolean;
      };
    };
    findWindowsCodeCommand: (
      env?: NodeJS.ProcessEnv,
      deps?: {
        existsSync?: (path: string) => boolean;
        spawnSync?: () => { error?: Error; stdout?: string };
      },
    ) => string;
  };

  const args = ["--install-extension", "C:\\tmp & 100%\\ttsc.vsix", "--force"];
  assert.deepEqual(mod.createCodeCommand(args, "linux"), {
    command: "code",
    args,
    options: {},
  });

  const noCodeCmd = {
    existsSync: () => false,
    spawnSync: () => ({ stdout: "" }),
  };
  const payload =
    '"%TTSC_VSCODE_COMMAND_SHIM_ARG_0% %TTSC_VSCODE_COMMAND_SHIM_ARG_1% %TTSC_VSCODE_COMMAND_SHIM_ARG_2% %TTSC_VSCODE_COMMAND_SHIM_ARG_3%"';
  assert.deepEqual(
    mod.createCodeCommand(args, "win32", { ComSpec: "cmd" }, noCodeCmd),
    {
      command: "cmd",
      args: ["/d", "/s", "/c", payload],
      options: {
        env: {
          ComSpec: "cmd",
          TTSC_VSCODE_COMMAND_SHIM_ARG_0: '"code.cmd"',
          TTSC_VSCODE_COMMAND_SHIM_ARG_1: '"--install-extension"',
          TTSC_VSCODE_COMMAND_SHIM_ARG_2: '"C:\\tmp & 100%\\ttsc.vsix"',
          TTSC_VSCODE_COMMAND_SHIM_ARG_3: '"--force"',
        },
        windowsVerbatimArguments: true,
      },
    },
  );

  const codeCmd =
    "C:\\Users\\sam\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd";
  const env = {
    ComSpec: "cmd",
    LOCALAPPDATA: "C:\\Users\\sam\\AppData\\Local",
  };
  const deps = {
    existsSync: (candidate: string) => candidate === codeCmd,
    spawnSync: () => ({ stdout: "D:\\repo\\node_modules\\.bin\\code.cmd\r\n" }),
  };
  assert.equal(mod.findWindowsCodeCommand(env, deps), codeCmd);
  assert.deepEqual(mod.createCodeCommand(args, "win32", env, deps), {
    command: "cmd",
    args: ["/d", "/s", "/c", payload],
    options: {
      env: {
        ...env,
        TTSC_VSCODE_COMMAND_SHIM_ARG_0: `"${codeCmd}"`,
        TTSC_VSCODE_COMMAND_SHIM_ARG_1: '"--install-extension"',
        TTSC_VSCODE_COMMAND_SHIM_ARG_2: '"C:\\tmp & 100%\\ttsc.vsix"',
        TTSC_VSCODE_COMMAND_SHIM_ARG_3: '"--force"',
      },
      windowsVerbatimArguments: true,
    },
  });

  if (process.platform !== "win32") {
    console.log(
      "Skipped Windows code.cmd child-argv assertions: cmd.exe is unavailable.",
    );
    return;
  }

  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-vscode-code-"));
  const sentinel = "TTSC_VSCODE_PERCENT_SENTINEL";
  const dir = path.join(base, "Code & SDK 100% %" + sentinel + "% ^");
  const code = path.join(dir, "code.cmd");
  const record = path.join(base, "record-argv.json");
  const recorder = path.join(base, "record-argv.cjs");
  const actualArgs = [
    "--install-extension",
    path.join(dir, "%" + sentinel + "%.vsix"),
    "--force",
    "%",
    "ends%",
    "%" + sentinel + "%",
    "%%",
    "a&b",
    "caret^",
    "",
    "trailing\\",
    'embedded " quote',
    'backslash-before-\\"quote',
  ];
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      recorder,
      [
        'const fs = require("node:fs");',
        "fs.writeFileSync(process.env.TTSC_VSCODE_TEST_RECORD, JSON.stringify(process.argv.slice(2)));",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      code,
      [
        "@echo off",
        '"%TTSC_VSCODE_TEST_NODE%" "%TTSC_VSCODE_TEST_RECORDER%" %*',
        "",
      ].join("\r\n"),
    );
    const command = mod.createCodeCommand(
      actualArgs,
      "win32",
      {
        ...process.env,
        ComSpec: process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe",
        [sentinel]: "EXPANDED",
        TTSC_VSCODE_TEST_NODE: process.execPath,
        TTSC_VSCODE_TEST_RECORDER: recorder,
        TTSC_VSCODE_TEST_RECORD: record,
      },
      {
        existsSync: (candidate: string) => candidate === code,
        spawnSync: () => ({ stdout: code + "\r\n" }),
      },
    );
    const result = spawnSync(command.command, command.args, {
      ...command.options,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(record, "utf8")), actualArgs);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
};
