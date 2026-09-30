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
  // The LSP proxy's own package. Its tests live beside it rather than under
  // ./test because they cover unexported logic: the completion matcher decides
  // what a plugin may offer at a cursor, and the resident-daemon client decides
  // when a warm Program is reused versus a spawn falls back. Exporting either to
  // test it would put an internal decision on the public surface.
  "./internal/lspserver",
  // The Linux directory notification helper behind `ttsc __watch`
  // (samchon/ttsc#1426). Its tests drive a real inotify instance, and build on
  // Linux only.
  "./internal/watchhelper",
  "./test/cli",
  "./test/ttscserver",
  "./test/platform",
  "./test/utility",
  "./cmd/ttsc",
  "./cmd/ttscserver",
];

// The single e2e race batch already owns every proxy assertion. Default local
// test:go keeps its normal, C-toolchain-independent package selection.
function selectedPackages(layer = process.env.TTSC_TEST_LAYER) {
  return packages.filter((entry) => layer !== "e2e" || entry !== "./internal/lspserver");
}

if (require.main === module) {
  const result = cp.spawnSync("go", ["test", "-count=1", ...selectedPackages()], {
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
}

module.exports = { selectedPackages };
