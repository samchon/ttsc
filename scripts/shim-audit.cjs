// Runs the mechanical shim-completeness gate (packages/ttsc/tools/shim_audit).
//
// The tool is its own Go module, so it must run from its own directory with the
// shim/anchor paths relative to it. Default mode is -check (the CI gate); pass
// another mode (e.g. -fix, -write-baseline, -md) as the first argument.
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const toolDir = path.join(__dirname, "..", "packages", "ttsc", "tools", "shim_audit");
const mode = process.argv[2] || "-check";

const result = cp.spawnSync(
  "go",
  ["run", ".", mode, "-anchor", "../../shim/ast", "-shim", "../../shim"],
  {
    cwd: toolDir,
    // -mod=readonly keeps the gate hermetic: loading the inner packages must
    // never mutate a shim module's go.sum (it would dirty the tree); an actually
    // missing entry should fail loudly, e.g. after a typescript-go bump.
    env: { ...process.env, PATH: goPath(), GOFLAGS: "-mod=readonly" },
    stdio: "inherit",
    windowsHide: true,
  },
);
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
