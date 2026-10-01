// Run owning Go units for the shim and its source generator.
//
// `shim/ast/test` is committed, executable, and passing, and no runner list
// named it, so it had never run in CI. It is its own Go module — the shim
// directories are separate modules by design — so it cannot join the
// `packages/ttsc` runner and needs its own working directory.
//
// `tools/shim_audit` is deliberately NOT here. It is also its own module, but
// `scripts/shim-audit-test.cjs` already runs it from its own root and the
// `shim-audit` workflow lane already calls that. Adding it here ran it a second
// time from the wrong module root, where `go test ./tools/shim_audit` cannot
// resolve a package outside the main module.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const goPath = fs.existsSync(goRoot)
  ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
  : process.env.PATH;

// The AST consumer has its own module root. The VFS package is tested through
// the compiler module's pinned dependency and replace directives, which supply
// its dependency checksums without creating a standalone shim-module go.sum.
const targets = [
  [path.join(root, "packages", "ttsc", "tools", "gen_shims"), "./..."],
  [path.join(root, "packages", "ttsc", "shim", "ast"), "./test"],
  [
    path.join(root, "packages", "ttsc"),
    "github.com/microsoft/typescript-go/shim/vfs",
  ],
];

let failed = 0;
for (const [cwd, pkg] of targets) {
  const result = cp.spawnSync("go", ["test", "-count=1", pkg], {
    cwd,
    env: { ...process.env, PATH: goPath },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    console.error(result.error);
    failed++;
    continue;
  }
  if ((result.status ?? 1) !== 0) failed++;
}

process.exit(failed === 0 ? 0 : 1);
