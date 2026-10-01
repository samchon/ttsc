import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code server launch uses command mode for JS launchers.
 *
 * `vscode-languageclient` module launches append NodeModule-only flags that the
 * native server does not own. The extension therefore builds explicit
 * command/args pairs: JavaScript launchers run through `process.execPath`, and
 * native binaries run directly, both carrying cwd, tsconfig, stdio, and the VS
 * Code wrapper-command suppression ids.
 *
 * 1. Import the pure launch helper through Node's TypeScript loader.
 * 2. Build launch commands for JS and native server paths.
 * 3. Build a Windows `.cmd` launch command.
 * 4. Assert the command/args shapes match the extension contract.
 *
 * @evidence contracts/testing.md#behavioral-verification createServerLaunchCommand selects Node, native or Windows shim execution and executeCommandIDPrefix separates client command namespaces.
 * @evidence contracts/testing.md#independent-expectations public launch commands carry stdio, cwd, config and suppressed command IDs; Windows shim environment preserves the literal argument array.
 * @evidence contracts/testing.md#distinguishing-cases JavaScript and native arrays contrast with pre-quoted cmd arguments, verbatim mode and six environment slots; different client roots receive distinct namespace prefixes.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_launch_command_uses_command_mode function runs under src/features/ttscserver and calls the authored resolution or launch-planning operations directly; no extension host or child process starts, and real shim spawn remains in E2E.
 */
export function test_vscode_server_launch_command_uses_command_mode() {
  const repo = TestProject.WORKSPACE_ROOT;
  const cwd = path.join(repo, "packages", "demo");
  const tsconfig = path.join(cwd, "tsconfig.app.json");
  const jsLauncher = path.join(cwd, "node_modules", "ttsc", "ttscserver.js");
  const nativeLauncher = path.join(cwd, "bin", "ttscserver");
  const cmdLauncher = "C:\\\\Tools & SDK\\\\ttscserver.cmd";

  const observed = (() => {
    const candidate = { cwd: (cwd), resolveFrom: (cwd), tsconfig: (tsconfig) };
    return {
      js: mod.createServerLaunchCommand((jsLauncher), candidate),
      native: mod.createServerLaunchCommand((nativeLauncher), candidate),
      cmd: mod.createServerLaunchCommand((cmdLauncher), candidate, "win32", { ComSpec: "cmd.exe" }),
      prefix: mod.executeCommandIDPrefix((cwd)),
      otherPrefix: mod.executeCommandIDPrefix((path.join(repo, "packages", "other"))),
    };
  
  })();
  const parsed = observed as {
    cmd: {
      args: string[];
      command: string;
      commandShimEnvironment?: NodeJS.ProcessEnv;
      windowsVerbatimArguments?: boolean;
    };
    js: { args: string[]; command: string; windowsVerbatimArguments?: boolean };
    native: {
      args: string[];
      command: string;
      windowsVerbatimArguments?: boolean;
    };
    otherPrefix: string;
    prefix: string;
  };
  assert.match(parsed.prefix, /^ttsc\.vscode\.[0-9a-f]{16}\.$/);
  assert.match(parsed.otherPrefix, /^ttsc\.vscode\.[0-9a-f]{16}\.$/);
  assert.notEqual(parsed.prefix, parsed.otherPrefix);
  assert.equal(parsed.js.command, process.execPath);
  assert.deepEqual(parsed.js.args, [
    jsLauncher,
    "--stdio",
    "--cwd=" + cwd,
    "--suppress-execute-command-ids=ttsc.lint.fixAll,ttsc.format.document",
    "--execute-command-id-prefix=" + parsed.prefix,
    "--tsconfig=" + tsconfig,
  ]);
  assert.equal(parsed.native.command, nativeLauncher);
  assert.deepEqual(parsed.native.args, [
    "--stdio",
    "--cwd=" + cwd,
    "--suppress-execute-command-ids=ttsc.lint.fixAll,ttsc.format.document",
    "--execute-command-id-prefix=" + parsed.prefix,
    "--tsconfig=" + tsconfig,
  ]);
  // Only the pre-quoted Windows command shim requests verbatim spawn arguments;
  // JS and native launchers keep Node's default array escaping.
  assert.equal(parsed.cmd.windowsVerbatimArguments, true);
  assert.equal(parsed.js.windowsVerbatimArguments, undefined);
  assert.equal(parsed.native.windowsVerbatimArguments, undefined);
  assert.equal(parsed.cmd.command, "cmd.exe");
  assert.equal(parsed.cmd.args[0], "/d");
  assert.equal(parsed.cmd.args[1], "/s");
  assert.equal(parsed.cmd.args[2], "/c");
  const cmdPayload = parsed.cmd.args[3] ?? "";
  assert.equal(
    cmdPayload,
    '"%TTSC_VSCODE_COMMAND_SHIM_ARG_0% %TTSC_VSCODE_COMMAND_SHIM_ARG_1% %TTSC_VSCODE_COMMAND_SHIM_ARG_2% %TTSC_VSCODE_COMMAND_SHIM_ARG_3% %TTSC_VSCODE_COMMAND_SHIM_ARG_4% %TTSC_VSCODE_COMMAND_SHIM_ARG_5%"',
  );
  assert.deepEqual(parsed.cmd.commandShimEnvironment, {
    TTSC_VSCODE_COMMAND_SHIM_ARG_0: `"${cmdLauncher}"`,
    TTSC_VSCODE_COMMAND_SHIM_ARG_1: '"--stdio"',
    TTSC_VSCODE_COMMAND_SHIM_ARG_2: `"--cwd=${cwd}"`,
    TTSC_VSCODE_COMMAND_SHIM_ARG_3:
      '"--suppress-execute-command-ids=ttsc.lint.fixAll,ttsc.format.document"',
    TTSC_VSCODE_COMMAND_SHIM_ARG_4: `"--execute-command-id-prefix=${parsed.prefix}"`,
    TTSC_VSCODE_COMMAND_SHIM_ARG_5: `"--tsconfig=${tsconfig}"`,
  });
}
