// Run the Go unit tests for the ttsc driver package.
//
// The driver tests exercise the public emit and plugin-transform API directly,
// including regressions that do not pass through utility plugin packages.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const result = cp.spawnSync("go", ["test", "-count=1", "./test/driver"], {
  cwd: path.join(root, "packages", "ttsc"),
  env: {
    ...process.env,
    PATH: fs.existsSync(goRoot)
      ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH,
  },
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
