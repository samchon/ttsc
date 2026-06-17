// Runs the unit tests for the mechanical shim-completeness auditor
// (packages/ttsc/tools/shim_audit), which is its own self-contained Go module.
//
// Mirrors shim-audit.cjs's local Go-SDK PATH resolution and runs `go test` from
// the tool's own directory. The tests are pure (stdlib + the tool's package), so
// -mod=readonly keeps them hermetic — no shim/typescript-go wiring is needed.
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const toolDir = path.join(__dirname, "..", "packages", "ttsc", "tools", "shim_audit");

const result = cp.spawnSync("go", ["test", "-count=1", "./..."], {
  cwd: toolDir,
  env: { ...process.env, PATH: goPath(), GOFLAGS: "-mod=readonly" },
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;

function goPath() {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}
