const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const [command, ...rest] = process.argv.slice(2);

if (!command) {
  throw new Error("go helper requires a command");
}

if (command === "build-native") {
  fs.mkdirSync("native", { recursive: true });
  runGo([
    "build",
    "-o",
    path.join("native", process.platform === "win32" ? "ttsc-native.exe" : "ttsc-native"),
    "./cmd/platform",
  ]);
} else {
  runGo([command, ...rest]);
}

function runGo(args) {
  const result = cp.spawnSync("go", args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: goPath(),
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
}

function goPath() {
  const home = os.homedir();
  const localGo = path.join(home, "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}
