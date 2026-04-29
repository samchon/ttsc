// Run the engine + config Go tests for the lint package.
//
// Tests live under `tests/lint/plugin/` and are copied next to the
// package's Go plugin sources in a scratch module. The published lint
// package stays free of `_test.go` files; the rule corpus is exercised
// end-to-end from `tests/lint/cases.test.cjs` instead.
//
// This runner mirrors the materialization `packages/ttsc/src/source-build.ts`
// performs at compile time:
//
//   1. Copy `packages/lint/` into a scratch tmpdir.
//   2. Copy `tests/lint/plugin/` into scratch/plugin.
//   3. Write a go.work that `use`s every in-tree shim, the lint
//      package itself, and the ttsc package (the latter is required so
//      Go workspace mode can resolve the multi-module placeholder
//      versions the shims declare).
//   4. Run `go test ./plugin` in the scratch dir.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lintPkgDir = path.join(root, "packages", "lint");
const lintTestsDir = path.join(root, "tests", "lint", "plugin");
const ttscDir = path.join(root, "packages", "ttsc");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-go-test-"));
try {
  // Copy the source module into the scratch dir, skipping build artifacts
  // the way materializeScratchDir does.
  const skip = new Set(["go.work", "go.work.sum", "node_modules", ".cache"]);
  fs.cpSync(lintPkgDir, scratch, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)),
  });
  fs.cpSync(lintTestsDir, path.join(scratch, "plugin"), { recursive: true });

  // Discover every in-tree module the workspace needs to satisfy:
  //   - the lint package (whose tests we're running),
  //   - packages/ttsc itself (required for shim resolution),
  //   - every shim/* under packages/ttsc with a go.mod.
  const useDirs = [scratch];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);

  fs.writeFileSync(
    path.join(scratch, "go.work"),
    `go 1.26\n\nuse (\n${useDirs.map((d) => `\t${d.replace(/\\/g, "/")}`).join("\n")}\n)\n`,
    "utf8",
  );

  const result = cp.spawnSync("go", ["test", "./plugin"], {
    cwd: scratch,
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
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function walkForGoMod(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((e) => e.isFile() && e.name === "go.mod")) {
    out.push(dir);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}
