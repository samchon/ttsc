#!/usr/bin/env node
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const pkgRoot = path.resolve(__dirname, "..");
const distDir = path.join(pkgRoot, "dist");
const extensionId = "samchon.ttsc";

const sub = process.argv[2] ?? "install";

function findVsix() {
  if (!fs.existsSync(distDir)) return null;
  const hits = fs.readdirSync(distDir).filter((f) => f.endsWith(".vsix"));
  return hits.length ? path.join(distDir, hits[0]) : null;
}

function runCode(args, vsixForFallback) {
  const r = cp.spawnSync("code", args, { stdio: "inherit" });
  if (r.error && r.error.code === "ENOENT") {
    console.error("`code` CLI not found on PATH.");
    console.error("Either:");
    console.error("  - Open VSCode, then run \"Shell Command: Install 'code' command in PATH\" from the command palette.");
    if (vsixForFallback) {
      console.error(`  - Or install manually: VSCode > Extensions > \"...\" menu > Install from VSIX > ${vsixForFallback}`);
    }
    process.exit(1);
  }
  process.exit(r.status ?? 1);
}

if (sub === "install") {
  const vsix = findVsix();
  if (!vsix) {
    console.error(`No .vsix bundled in ${distDir}. Reinstall @ttsc/vscode or report a packaging bug.`);
    process.exit(1);
  }
  runCode(["--install-extension", vsix, "--force"], vsix);
} else if (sub === "uninstall") {
  runCode(["--uninstall-extension", extensionId]);
} else {
  console.error(`Usage: ttsc-vscode <install|uninstall>`);
  process.exit(1);
}
