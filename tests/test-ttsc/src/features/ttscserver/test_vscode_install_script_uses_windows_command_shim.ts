import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
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
 * 4. Compare the preferred installation and lookup fallback selections.
 *
 * @evidence contracts/testing.md#behavioral-verification The installer constructs direct POSIX and quoted Windows commands with exact environment slot values and selects the discovered Code command.
 * @evidence contracts/testing.md#independent-expectations Authored spaces and shell metacharacters establish the exact literal argv; literal argument and environment expectations distinguish quoting decisions; actual cmd interpretation is covered separately in the OS batch.
 * @evidence contracts/testing.md#distinguishing-cases The POSIX direct command versus the Windows cmd.exe shim, arguments with spaces and shell metacharacters carried through environment slots, and the preferred Code installation versus the lookup fallback.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/ttscserver function calls createCodeCommand and findWindowsCodeCommand directly with supplied existence and lookup operations; actual child argv runs in os-boundaries/ttscserver.
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

};
