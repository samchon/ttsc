// Run the engine + config Go tests for the lint package.
//
// Tests live under `packages/lint/test/` and are copied next to the package's
// Go plugin sources in a scratch module. The rule corpus is still exercised
// end-to-end from `tests/test-lint/src/features/rules/test_*.ts`; these Go
// tests cover engine/config internals with package-local ownership.
//
// This runner mirrors the materialization `packages/ttsc/src/source-build.ts`
// performs at compile time:
//
//   1. Copy `packages/lint/` into a scratch tmpdir.
//   2. Copy every Go file under `packages/lint/test/` into scratch/plugin.
//      The source tree is categorized for review, but the files are flattened
//      in scratch because they intentionally test unexported package-main
//      internals next to the plugin sources.
//   3. Write a go.work that `use`s every in-tree shim, the lint
//      package itself, and the ttsc package (the latter is required so
//      Go workspace mode can resolve the multi-module placeholder
//      versions the shims declare).
//   4. Run `go test ./plugin` in the scratch dir.

const cp = require("node:child_process");
const { createRequire } = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lintPkgDir = path.join(root, "packages", "lint");
const lintTestsDir = path.join(lintPkgDir, "test");
const ttscDir = path.join(root, "packages", "ttsc");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttsxBinary = path.join(ttscDir, "lib", "launcher", "ttsx.js");
const tsgoBinary = resolveTsgoBinary();

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-go-test-"));
try {
  // Copy the source module into the scratch dir, skipping build artifacts
  // the way materializeScratchDir does.
  const skip = new Set(["go.work", "go.work.sum", "node_modules", ".cache"]);
  fs.cpSync(lintPkgDir, scratch, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)),
  });
  copyGoTestsFlat(lintTestsDir, path.join(scratch, "plugin"));

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
      TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? tsgoBinary,
      TTSC_TTSX_BINARY: process.env.TTSC_TTSX_BINARY ?? ttsxBinary,
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

function resolveTsgoBinary() {
  const packageJson = require.resolve("@typescript/native-preview/package.json", {
    paths: [root],
  });
  const requireFromNativePreview = createRequire(packageJson);
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
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
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkForGoFiles(file));
    } else if (entry.isFile() && entry.name.endsWith(".go")) {
      out.push(file);
    }
  }
  return out.sort();
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
