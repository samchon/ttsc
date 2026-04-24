const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const result = cp.spawnSync("go", ["test", "./..."], {
  cwd: path.join(root, "tests", "go-transformer"),
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
