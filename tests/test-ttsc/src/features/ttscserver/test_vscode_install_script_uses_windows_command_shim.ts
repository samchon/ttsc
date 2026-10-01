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
 * 4. With no installed `code.cmd` the command falls back to the bare `code.cmd`;
 *    with an installed `code.cmd` under LOCALAPPDATA it is chosen even though
 *    `where.exe` reports a different (nonexistent) path.
 *
 * @evidence contracts/testing.md#behavioral-verification Requires the real packages/vscode/bin/install.js and calls createCodeCommand for linux and for win32 (with injected existsSync/spawnSync), and findWindowsCodeCommand, asserting the full returned command objects including the TTSC_VSCODE_COMMAND_SHIM_ARG_n environment slots and windowsVerbatimArguments.
 * @evidence contracts/testing.md#independent-expectations The expected objects are literal: the argument `C:\tmp & 100%\ttsc.vsix` contains a space, an ampersand and a percent sign and must appear quoted inside its own environment slot, while the cmd payload only holds %slot% placeholders. cmd.exe itself never interprets these strings in this test, so the quoting is checked as data, not as shell behavior.
 * @evidence contracts/testing.md#distinguishing-cases The linux platform returns a direct `code` command with unmodified args; win32 returns the cmd shim. For lookup, an absent installation yields the default `code.cmd` and a present LOCALAPPDATA installation is chosen while the differing path `where.exe` reports does not exist. The ProgramFiles candidates and a where.exe result that does exist are not covered.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it loads install.js without running its CLI main and calls the two exported functions with injected filesystem and process doubles, so no VS Code, cmd.exe or child process runs.
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
