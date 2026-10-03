import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
import fs from "node:fs";
import { createRequire } from "node:module";
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
 * @evidence contracts/testing.md#execution-ownership The existing Windows installation caller invokes this workspace installer operation with declared lookup dependencies selecting the authored shim. Actual cmd/shim/Node recording is exercised, not installed VSCode or extension installation; source-unit execution is not certified here.
 * @evidence contracts/e2e.md#necessary-boundary Real Windows cmd.exe interpretation and recording code.cmd transport can corrupt argv even when constructed strings look correct; source unit calls cannot establish this transport.
 * @evidence contracts/e2e.md#shared-execution One actual command-shell invocation plus its recorder Node carry the thirteen literal arguments. Existing installation session supplies platform execution but is not this SUT; real process totals remain unmeasured, no compiler/Go preparation is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root owns shim/recorder/result paths and is retained before preparation; percent sentinel is child-only. Synchronous error/signal/status does not certify descendant closure, so this case withholds fixture deletion rather than masking a body failure with cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original thirteen literal argv, actual Windows status0 and complete recorded-array equality remain. Portable command/lookup source contribution is distinct and its actual selection/survival is not certified by this transport entry.
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
  const base = TestProject.tmpdir("ttsc-vscode-code-");
  TestProject.retainTemporaryDirectory(base, "Windows install shim has no descendant join acknowledgement");
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
    assert.equal(result.error, undefined, "Windows install shim launch error");
    assert.equal(result.signal, null, "Windows install shim terminated by signal");
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(record, "utf8")), actualArgs);
  } finally {
    // Tracked inputs remain retained until actual descendant closure is proved.
  }
};
