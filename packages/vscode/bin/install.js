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
  deps = {},
) {
  if (platform === "win32") {
    const launcher = findWindowsCodeCommand(env, deps);
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", quoteWindowsCommand([launcher, ...args])],
      // The `/c` payload is already fully quoted. Node's Windows spawn escapes
      // each arg again unless told not to, turning `""code.cmd" ...` into
      // `"\"\"code.cmd\" ...\""`, which cmd.exe sees as one un-runnable token
      // after the CVE-2024-27980 argument-escaping change. Pass the payload
      // verbatim so cmd's `/s` strips the outer quotes and runs `code.cmd ...`.
      options: { windowsVerbatimArguments: true },
    };
  }
  return { command: "code", args, options: {} };
}

function findWindowsCodeCommand(env = process.env, deps = {}) {
  const existsSync = deps.existsSync ?? fs.existsSync;
  const spawnSync = deps.spawnSync ?? cp.spawnSync;
  const candidates = [];
  const add = (candidate) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };

  for (const candidate of [
    env.LOCALAPPDATA &&
      path.win32.join(
        env.LOCALAPPDATA,
        "Programs",
        "Microsoft VS Code",
        "bin",
        "code.cmd",
      ),
    env.ProgramFiles &&
      path.win32.join(env.ProgramFiles, "Microsoft VS Code", "bin", "code.cmd"),
    env["ProgramFiles(x86)"] &&
      path.win32.join(
        env["ProgramFiles(x86)"],
        "Microsoft VS Code",
        "bin",
        "code.cmd",
      ),
  ]) {
    add(candidate);
  }

  const where = spawnSync("where.exe", ["code.cmd"], {
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  if (!where.error && typeof where.stdout === "string") {
    for (const line of where.stdout.split(/\r?\n/)) add(line.trim());
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? "code.cmd";
}

function quoteWindowsCommand(args) {
  return `"${args.map(quoteWindowsArg).join(" ")}"`;
}

function quoteWindowsArg(arg) {
  return `"${String(arg).replace(/"/g, '\\"').replace(/%/g, "%%")}"`;
}

function spawnCode(args, vsixForFallback) {
  const command = createCodeCommand(args);
  const r = cp.spawnSync(command.command, command.args, {
    stdio: "inherit",
    ...command.options,
  });
  if (r.error && r.error.code === "ENOENT") {
    printCodeNotFound(vsixForFallback);
    process.exit(1);
  }
  return r.status ?? 1;
}

function runCode(args, vsixForFallback) {
  const status = spawnCode(args, vsixForFallback);
  if (process.platform === "win32" && status !== 0) {
    printCodeFailed(status, vsixForFallback);
  }
  process.exit(status);
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
    // Remove any previously installed version first so versions do not pile up
    // in VS Code. Ignore its exit status: the extension may not be installed.
    spawnCode(["--uninstall-extension", extensionId], vsix);
    runCode(["--install-extension", vsix, "--force"], vsix);
  } else if (sub === "uninstall") {
    runCode(["--uninstall-extension", extensionId]);
  } else {
    console.error(`Usage: npx @ttsc/vscode <install|uninstall>`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createCodeCommand,
  findWindowsCodeCommand,
  findVsix,
  main,
  quoteWindowsCommand,
};
