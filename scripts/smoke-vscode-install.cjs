#!/usr/bin/env node
const cp = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const packageRoot = path.resolve(process.argv[2] ?? "packages/vscode");
const installScript = path.join(packageRoot, "bin", "install.js");
const extensionId = "samchon.ttsc";
const installer = require(installScript);

run(process.execPath, [
  path.join(repoRoot, "scripts", "assert-vscode-package.cjs"),
  packageRoot,
]);
runCode(["--version"]);
const wasInstalled = listExtensions().includes(extensionId);

let failed;
try {
  run(process.execPath, [installScript, "install"], { cwd: packageRoot });
  const extensions = listExtensions();
  if (!extensions.includes(extensionId)) {
    throw new Error(
      `VS Code extension ${extensionId} was not installed; installed extensions: ${JSON.stringify(extensions)}`,
    );
  }
} catch (error) {
  failed = error;
} finally {
  if (!wasInstalled) {
    const uninstall = cp.spawnSync(
      process.execPath,
      [installScript, "uninstall"],
      {
        cwd: packageRoot,
        stdio: failed ? "ignore" : "inherit",
        windowsHide: true,
      },
    );
    if (!failed) {
      assertResult(uninstall, process.execPath, [installScript, "uninstall"]);
    }
  }
}

if (failed) throw failed;

function runCode(args, options = {}) {
  const command = installer.createCodeCommand(args);
  return run(command.command, command.args, {
    ...command.options,
    capture: options.capture,
  });
}

function listExtensions() {
  return runCode(["--list-extensions"], { capture: true })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function run(command, args, options = {}) {
  const result = cp.spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    windowsHide: true,
    windowsVerbatimArguments: options.windowsVerbatimArguments,
  });
  assertResult(result, command, args);
  return result.stdout ?? "";
}

function assertResult(result, command, args) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with status ${result.status ?? 1}`,
    );
  }
}
