import { TestProject } from "@ttsc/testing";
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
 * 3. Assert Windows uses one quoted `cmd.exe /d /s /c` payload.
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
    ) => { args: string[]; command: string };
  };

  const args = ["--install-extension", "C:\\tmp & 100%\\ttsc.vsix", "--force"];
  assert.deepEqual(mod.createCodeCommand(args, "linux"), {
    command: "code",
    args,
  });
  assert.deepEqual(mod.createCodeCommand(args, "win32", { ComSpec: "cmd" }), {
    command: "cmd",
    args: [
      "/d",
      "/s",
      "/c",
      '""code" "--install-extension" "C:\\tmp & 100%%\\ttsc.vsix" "--force""',
    ],
  });
};
