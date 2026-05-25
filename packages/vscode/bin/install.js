#!/usr/bin/env node
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const pkgRoot = path.resolve(__dirname, "..");
const distDir = path.join(pkgRoot, "dist");
const extensionId = "samchon.ttsc";
const version = require(path.join(pkgRoot, "package.json")).version;

function findVsix() {
  if (!fs.existsSync(distDir)) return null;
  const expected = path.join(distDir, `ttsc-vscode-${version}.vsix`);
  return fs.existsSync(expected) ? expected : null;
}

function createCodeCommand(
  args,
  platform = process.platform,
  env = process.env,
) {
  if (platform === "win32") {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", quoteWindowsCommand(["code", ...args])],
    };
  }
  return { command: "code", args };
}

function quoteWindowsCommand(args) {
  return `"${args.map(quoteWindowsArg).join(" ")}"`;
}

function quoteWindowsArg(arg) {
  return `"${String(arg).replace(/"/g, '\\"').replace(/%/g, "%%")}"`;
}

function runCode(args, vsixForFallback) {
  const command = createCodeCommand(args);
  const r = cp.spawnSync(command.command, command.args, { stdio: "inherit" });
  if (r.error && r.error.code === "ENOENT") {
    printCodeNotFound(vsixForFallback);
    process.exit(1);
  }
  if (process.platform === "win32" && (r.status ?? 1) !== 0) {
    printCodeFailed(r.status ?? 1, vsixForFallback);
  }
  process.exit(r.status ?? 1);
}

function printCodeNotFound(vsixForFallback) {
  console.error("`code` CLI not found on PATH.");
  console.error("Either:");
  console.error(
    "  - Open VS Code, then run \"Shell Command: Install 'code' command in PATH\" from the command palette.",
  );
  if (vsixForFallback) {
    console.error(
      `  - Or install manually: VS Code > Extensions > \"...\" menu > Install from VSIX > ${vsixForFallback}`,
    );
  }
}

function printCodeFailed(status, vsixForFallback) {
  console.error(`VS Code CLI exited with status ${status}.`);
  if (vsixForFallback) {
    console.error(
      `Install manually: VS Code > Extensions > "..." menu > Install from VSIX > ${vsixForFallback}`,
    );
  }
}

function main(argv = process.argv.slice(2)) {
  const sub = argv[0] ?? "install";
  if (sub === "install") {
    const vsix = findVsix();
    if (!vsix) {
      console.error(
        `No .vsix bundled in ${distDir}. Reinstall @ttsc/vscode or report a packaging bug.`,
      );
      process.exit(1);
    }
    runCode(["--install-extension", vsix, "--force"], vsix);
  } else if (sub === "uninstall") {
    runCode(["--uninstall-extension", extensionId]);
  } else {
    console.error(`Usage: ttsc-vscode <install|uninstall>`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createCodeCommand,
  findVsix,
  main,
  quoteWindowsCommand,
};
