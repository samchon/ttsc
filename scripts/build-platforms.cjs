const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packagesDir = path.join(root, "packages");

run(["--filter", "ttsc", "build"]);
run(["--filter", "@ttsc/lint", "build"]);

for (const platformDir of listPlatformPackageDirs()) {
  console.log(`Building platform package: ${path.basename(platformDir)}`);
  const result = cp.spawnSync(process.execPath, [path.join(root, "scripts", "build-platform-package.cjs")], {
    cwd: platformDir,
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

function listPlatformPackageDirs() {
  return fs
    .readdirSync(packagesDir)
    .filter((entry) => /^ttsc-(linux|darwin|win32)-(x64|arm|arm64)$/.test(entry))
    .sort()
    .map((entry) => path.join(packagesDir, entry));
}
