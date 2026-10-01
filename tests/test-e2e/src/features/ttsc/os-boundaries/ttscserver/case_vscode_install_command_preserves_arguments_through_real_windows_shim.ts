import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

/**
 * Verifies the VS Code install command preserves literal Windows shim arguments.
 *
 * Command quoting must survive actual cmd.exe interpretation, including percent
 * variables, empty arguments and embedded quotes. Portable command decisions
 * are exercised in the separate installer source unit.
 *
 * 1. Create a recording code.cmd under paths containing shell metacharacters.
 * 2. Execute the installer command through cmd.exe with literal argument inputs.
 * 3. Assert successful exit and exact recorded argv, then remove the fixture.
 *
 * @evidence contracts/testing.md#behavioral-verification createCodeCommand crosses actual cmd.exe and code.cmd execution; recorded argv must equal every authored input, including percent markers, empty values, trailing backslashes and quotes.
 * @evidence contracts/testing.md#independent-expectations The literal actualArgs array is authored before command construction; an EXPANDED sentinel exposes unintended percent-variable expansion in the recorded result.
 * @evidence contracts/testing.md#distinguishing-cases Spaces, ampersands, carets, bare and paired percent signs, empty strings, trailing backslashes, embedded quotes and a backslash before a quote retain distinct argv positions.
 * @evidence contracts/testing.md#execution-ownership This named os-boundaries/ttscserver entry runs only on Windows within the sole installation matrix; portable createCodeCommand and findWindowsCodeCommand decisions execute in src/features/ttscserver.
 * @evidence contracts/e2e.md#necessary-boundary Real Windows cmd.exe interpretation and recording code.cmd transport can corrupt argv even when constructed strings look correct; source unit calls cannot establish this transport.
 * @evidence contracts/e2e.md#shared-execution One recording shim process carries all argument distinctions in the existing installation OS session; no independent installation, compiler or Go producer is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private root owns shim, recorder and result paths; child-only environment owns the percent sentinel, synchronous completion ends the process, and finally removes the fixture.
 * @evidence contracts/e2e.md#preserved-coverage The original Windows successful exit and exact argv assertion remain here; all original portable command and lookup assertions execute in test_vscode_install_script_uses_windows_command_shim under src/features/ttscserver.
 */
export const case_vscode_install_command_preserves_arguments_through_real_windows_shim = () => {
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

  if (process.platform !== "win32") return;
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
