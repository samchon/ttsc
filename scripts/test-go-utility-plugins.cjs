// Run Go unit tests for utility output plugins that own their native
// implementations under their package directories.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const packages = ["banner", "paths", "strip"];

for (const name of packages) {
  const cwd = path.join(root, "packages", name, "go-plugin");
  const result = cp.spawnSync("go", ["test", "./..."], {
    cwd,
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
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
