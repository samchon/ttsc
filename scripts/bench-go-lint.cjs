// Run the engine Go benchmarks (`go test -bench`) for the lint package.
//
// Mirrors `scripts/test-go-lint.cjs`'s scratch-overlay setup so the linthost
// package can resolve its in-tree shim dependencies via `go.work`. Where the
// test runner runs `go test -count=1 ./linthost`, this runner runs
// `go test -bench=. -run=^$ -benchmem -benchtime=<dur> ./linthost`, so
// benchmark methods (`Benchmark*`) execute without the regular `Test*` suite
// being re-run on every iteration.
//
// Usage:
//   node scripts/bench-go-lint.cjs                 # default ./linthost, -bench=.
//   node scripts/bench-go-lint.cjs -bench=^BenchmarkEngineRun$
//   node scripts/bench-go-lint.cjs -benchtime=5s
//   node scripts/bench-go-lint.cjs -cpuprofile=/tmp/cpu.out
//
// Any additional argv is forwarded verbatim to `go test`.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lintPkgDir = path.join(root, "packages", "lint");
const lintTestsDir = path.join(lintPkgDir, "test");
const ttscDir = path.join(root, "packages", "ttsc");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");

const userArgs = process.argv.slice(2);
const hasFlag = (name) => userArgs.some((a) => a === name || a.startsWith(name + "="));

const defaultArgs = [];
if (!hasFlag("-bench")) defaultArgs.push("-bench=.");
if (!hasFlag("-run")) defaultArgs.push("-run=^$");
if (!hasFlag("-benchmem")) defaultArgs.push("-benchmem");
if (!hasFlag("-benchtime")) defaultArgs.push("-benchtime=2s");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-go-bench-"));
try {
  const skip = new Set(["go.work", "go.work.sum", "node_modules", ".cache"]);
  fs.cpSync(lintPkgDir, scratch, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)),
  });
  copyGoTestsFlat(lintTestsDir, path.join(scratch, "linthost"));

  // "." instead of the absolute scratch path: Windows Go canonicalizes the
  // temp directory differently than Node spells it and rejects the absolute
  // entry from the workspace (see scripts/test-go-lint.cjs).
  const useDirs = ["."];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) useDirs.push(ttscDir);
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);

  fs.writeFileSync(
    path.join(scratch, "go.work"),
    `go 1.26\n\nuse (\n${useDirs.map((d) => `\t${d.replace(/\\/g, "/")}`).join("\n")}\n)\n`,
    "utf8",
  );

  const goArgs = ["test", ...defaultArgs, ...userArgs, "./linthost"];
  const result = cp.spawnSync("go", goArgs, {
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
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function copyGoTestsFlat(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const seen = new Set();
  for (const file of walkForGoFiles(sourceDir)) {
    const basename = path.basename(file);
    if (seen.has(basename)) {
      throw new Error(`duplicate lint Go test filename: ${basename}`);
    }
    seen.add(basename);
    fs.copyFileSync(file, path.join(targetDir, basename));
  }
}

function walkForGoFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...walkForGoFiles(p));
    } else if (entry.isFile() && entry.name.endsWith(".go")) {
      out.push(p);
    }
  }
  return out;
}

function walkForGoMod(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = path.join(dir, entry.name);
    if (fs.existsSync(path.join(sub, "go.mod"))) out.push(sub);
    walkForGoMod(sub, out);
  }
}
