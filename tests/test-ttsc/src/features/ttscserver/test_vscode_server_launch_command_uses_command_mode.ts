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
 * 1. Build launch commands for a `.js` launcher and a native launcher for one
 *    project candidate.
 * 2. Build a `.cmd` launch command for platform `win32` with ComSpec `cmd.exe`.
 * 3. Compute the command-ID prefix for two different project roots.
 * 4. Assert the command/args shapes, verbatim flags, shim environment and
 *    prefixes match the extension contract.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createServerLaunchCommand for a JS launcher, a native launcher and a Windows .cmd launcher, plus executeCommandIDPrefix for two roots, and asserts command, args, windowsVerbatimArguments, the cmd /d /s /c payload and the full commandShimEnvironment.
 * @evidence contracts/testing.md#independent-expectations The expected argument vectors are authored literals (--stdio, --cwd=, the suppressed command IDs ttsc.lint.fixAll,ttsc.format.document, --execute-command-id-prefix=, --tsconfig=), the shim payload is the literal six-placeholder string, and the prefix is only required to match ttsc.vscode.<16 hex>. and to differ between roots.
 * @evidence contracts/testing.md#distinguishing-cases The JavaScript launcher runs through process.execPath with the script as first argument and the native launcher runs directly, neither with verbatim arguments; the .cmd launcher runs through cmd.exe /d /s /c with pre-quoted environment slots and verbatim arguments; two project roots must get different prefixes. A candidate without a tsconfig is not covered.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls the pure serverResolution launch-planning functions and spawns nothing: no VS Code host, language client, cmd.exe or ttscserver process runs.
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
