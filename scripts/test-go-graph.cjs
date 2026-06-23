// Run the Go unit tests for the @ttsc/graph engine and command (the
// packages/ttsc/internal/graph package plus the ttscgraph and graphbench
// commands).
//
// Mirrors test-go-transformer.cjs: the packages resolve their shim dependencies
// through packages/ttsc/go.mod's local `replace` directives and the pinned
// typescript-go in the module cache, so a plain `go test` from the ttsc module
// root needs no generated go.work overlay. The cmd packages are included so the
// daemon, the --connect proxy, and the CLI flag handling are exercised, not just
// compiled by `go vet`.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const result = cp.spawnSync("go", ["test", "-count=1", "./internal/graph/...", "./cmd/ttscgraph/...", "./cmd/graphbench/..."], {
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
