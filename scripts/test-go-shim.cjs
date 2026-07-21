// Run the Go tests that live inside the shim and its audit tooling.
//
// Both are committed, executable, and passing, and neither was named by any
// runner list, so neither had ever run in CI. `shim/ast/test` is its own Go
// module — the shim directories are separate modules by design — so it cannot
// join the `packages/ttsc` runner and needs its own working directory.
// `tools/shim_audit` is the completeness gate's own unit coverage, which is the
// last place a silent failure should be acceptable.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const goPath = fs.existsSync(goRoot)
  ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
  : process.env.PATH;

// [working directory, package] pairs, because these are separate Go modules.
const targets = [
  [path.join(root, "packages", "ttsc", "shim", "ast"), "./test"],
  [path.join(root, "packages", "ttsc"), "./tools/shim_audit"],
];

let failed = 0;
for (const [cwd, pkg] of targets) {
  const result = cp.spawnSync("go", ["test", "-count=1", pkg], {
    cwd,
    env: { ...process.env, PATH: goPath },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) failed++;
}

process.exit(failed === 0 ? 0 : 1);
