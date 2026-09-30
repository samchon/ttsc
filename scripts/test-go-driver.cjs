// Run the Go unit tests for the ttsc driver packages.
//
// The package-local tests exercise internal observation invariants, while the
// external driver tests exercise the public emit and plugin-transform API.
// Both own regressions that do not pass through utility plugin packages.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const DRIVER_TEST_PACKAGES = ["./driver", "./test/driver"];
if (require.main === module) {
  const result = cp.spawnSync(
    "go",
    ["test", "-count=1", ...DRIVER_TEST_PACKAGES],
    {
      cwd: path.join(root, "packages", "ttsc"),
      env: {
        ...process.env,
        PATH: fs.existsSync(goRoot)
          ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
          : process.env.PATH,
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

module.exports = { DRIVER_TEST_PACKAGES };
