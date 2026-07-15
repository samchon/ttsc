// Run the ttsc command and integration Go test packages.
//
// These six packages exercise the CLI front doors and platform host behind
// ttsc: `test/cli`, `test/ttscserver`, `test/platform`, `test/utility`,
// `cmd/ttsc`, and `cmd/ttscserver`. They were never in `pnpm test:go`, so 79
// test functions had no CI signal (issue #622). The compiler is linked through
// `shim/bundled`, so — like `test-go-driver.cjs` — they need only Go on PATH,
// not a resolved tsgo/ttsx binary.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");

const packages = [
  "./test/cli",
  "./test/ttscserver",
  "./test/platform",
  "./test/utility",
  "./cmd/ttsc",
  "./cmd/ttscserver",
];

const result = cp.spawnSync("go", ["test", "-count=1", ...packages], {
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
