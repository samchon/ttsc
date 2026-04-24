const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const platformKey = `${process.platform}-${process.arch}`;
const platformDir = path.join(root, "packages", `ttsc-${platformKey}`);

if (!fs.existsSync(path.join(platformDir, "package.json"))) {
  throw new Error(`Unsupported current platform package: ttsc-${platformKey}`);
}

run(["--filter", "ttsc", "build"]);
run(["--dir", platformDir, "build"]);

function run(args) {
  const result = cp.spawnSync(...pnpmCommand(args), {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function pnpmCommand(args) {
  if (process.platform !== "win32") {
    return ["pnpm", args];
  }
  return ["cmd.exe", ["/d", "/s", "/c", "pnpm", ...args]];
}
