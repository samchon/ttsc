import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
 */
export const test_vscode_server_launch_command_uses_command_mode = () => {
  const repo = TestProject.WORKSPACE_ROOT;
  const cwd = path.join(repo, "packages", "demo");
  const tsconfig = path.join(cwd, "tsconfig.app.json");
  const jsLauncher = path.join(cwd, "node_modules", "ttsc", "ttscserver.js");
  const nativeLauncher = path.join(cwd, "bin", "ttscserver");
  const cmdLauncher = "C:\\\\Tools & SDK\\\\ttscserver.cmd";

  const script = `
    import { pathToFileURL } from "node:url";
    const mod = await import(pathToFileURL(${JSON.stringify(
      path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
    )}).href);
    const candidate = { cwd: ${JSON.stringify(cwd)}, resolveFrom: ${JSON.stringify(
      cwd,
    )}, tsconfig: ${JSON.stringify(tsconfig)} };
    console.log(JSON.stringify({
      js: mod.createServerLaunchCommand(${JSON.stringify(jsLauncher)}, candidate),
      native: mod.createServerLaunchCommand(${JSON.stringify(nativeLauncher)}, candidate),
      cmd: mod.createServerLaunchCommand(${JSON.stringify(cmdLauncher)}, candidate, "win32", { ComSpec: "cmd.exe" }),
      prefix: mod.executeCommandIDPrefix(${JSON.stringify(cwd)}),
      otherPrefix: mod.executeCommandIDPrefix(${JSON.stringify(path.join(repo, "packages", "other"))}),
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
    cmd: { args: string[]; command: string };
    js: { args: string[]; command: string };
    native: { args: string[]; command: string };
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
  assert.equal(parsed.cmd.command, "cmd.exe");
  assert.equal(parsed.cmd.args[0], "/d");
  assert.equal(parsed.cmd.args[1], "/s");
  assert.equal(parsed.cmd.args[2], "/c");
  const cmdPayload = parsed.cmd.args[3] ?? "";
  assert.match(cmdPayload, /^""C:\\\\Tools & SDK\\\\ttscserver\.cmd"/);
  assert.match(cmdPayload, /"--cwd=/);
};
