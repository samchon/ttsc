// Run the @ttsc/lint Go-side tests.
//
// Tests live under `packages/lint/tests/go-plugin/` as an external Go
// module — `package lint_test` — so the lint package's source dir
// stays free of `_test.go` files. The runner mirrors the materialization
// `packages/ttsc/src/source-build.ts` performs at compile time:
//
//   1. Copy `tests/go-plugin/` into a scratch tmpdir.
//   2. Write a go.work that `use`s every in-tree shim, the lint
//      package itself, and the ttsc package (the latter is required so
//      Go workspace mode can resolve the multi-module placeholder
//      versions the shims declare).
//   3. Run `go test ./...` in the scratch dir.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const lintPkgDir = path.join(root, "packages", "lint", "go-plugin");
const lintTestsDir = path.join(root, "packages", "lint", "tests", "go-plugin");
const ttscDir = path.join(root, "packages", "ttsc");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-go-test-"));
try {
  // Copy the test module into the scratch dir, skipping go.work files
  // and the build artifacts cache the way materializeScratchDir does.
  const skip = new Set(["go.work", "go.work.sum", "node_modules"]);
  fs.cpSync(lintTestsDir, scratch, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)),
  });

  // Rewrite the dev-mode relative `replace` paths to the *absolute*
  // in-tree locations the workspace overlay also points at. Without
  // this rewrite, the relative paths from go.mod resolve outside the
  // scratch dir and Go reports "conflicting replacements" when both
  // the go.mod replace and the workspace go.work try to provide the
  // same module from different directories.
  rewriteReplacePaths(path.join(scratch, "go.mod"), {
    "github.com/samchon/ttsc/packages/lint/go-plugin": lintPkgDir,
    "github.com/microsoft/typescript-go/shim/ast": path.join(ttscDir, "shim", "ast"),
    "github.com/microsoft/typescript-go/shim/bundled": path.join(ttscDir, "shim", "bundled"),
    "github.com/microsoft/typescript-go/shim/checker": path.join(ttscDir, "shim", "checker"),
    "github.com/microsoft/typescript-go/shim/compiler": path.join(ttscDir, "shim", "compiler"),
    "github.com/microsoft/typescript-go/shim/core": path.join(ttscDir, "shim", "core"),
    "github.com/microsoft/typescript-go/shim/diagnosticwriter": path.join(ttscDir, "shim", "diagnosticwriter"),
    "github.com/microsoft/typescript-go/shim/parser": path.join(ttscDir, "shim", "parser"),
    "github.com/microsoft/typescript-go/shim/scanner": path.join(ttscDir, "shim", "scanner"),
    "github.com/microsoft/typescript-go/shim/tsoptions": path.join(ttscDir, "shim", "tsoptions"),
    "github.com/microsoft/typescript-go/shim/tspath": path.join(ttscDir, "shim", "tspath"),
    "github.com/microsoft/typescript-go/shim/vfs": path.join(ttscDir, "shim", "vfs"),
    "github.com/microsoft/typescript-go/shim/vfs/cachedvfs": path.join(ttscDir, "shim", "vfs", "cachedvfs"),
    "github.com/microsoft/typescript-go/shim/vfs/osvfs": path.join(ttscDir, "shim", "vfs", "osvfs"),
  });

  // Discover every in-tree module the workspace needs to satisfy:
  //   - the lint package (whose tests we're running),
  //   - packages/ttsc itself (required for shim resolution),
  //   - every shim/* under packages/ttsc with a go.mod.
  const useDirs = [scratch, lintPkgDir];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);

  fs.writeFileSync(
    path.join(scratch, "go.work"),
    `go 1.26\n\nuse (\n${useDirs.map((d) => `\t${d.replace(/\\/g, "/")}`).join("\n")}\n)\n`,
    "utf8",
  );

  const result = cp.spawnSync("go", ["test", "./..."], {
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

// rewriteReplacePaths rewrites every `replace foo => <relative>` in a
// go.mod so the right-hand-side becomes the absolute path supplied via
// the `targets` map (key: module path). Lines whose target isn't in the
// map are dropped. Handles both grouped (`replace (...)`) and inline
// `replace foo => bar` forms.
function rewriteReplacePaths(goModPath, targets) {
  if (!fs.existsSync(goModPath)) return;
  const original = fs.readFileSync(goModPath, "utf8");
  const lines = original.split(/\r?\n/);
  const out = [];
  let inGroup = false;
  for (const line of lines) {
    if (inGroup) {
      if (line.trim() === ")") {
        inGroup = false;
        out.push(line);
        continue;
      }
      const m = line.match(/^(\s*)([^\s=]+)\s+=>\s+(\S.*)$/);
      if (!m) {
        out.push(line);
        continue;
      }
      const [, indent, name] = m;
      const target = targets[name];
      if (!target) continue; // drop unknown
      out.push(`${indent}${name} => ${target.replace(/\\/g, "/")}`);
      continue;
    }
    if (/^\s*replace\s*\(/.test(line)) {
      inGroup = true;
      out.push(line);
      continue;
    }
    const inline = line.match(/^(\s*replace\s+)([^\s=]+)\s+=>\s+(\S.*)$/);
    if (inline) {
      const [, prefix, name] = inline;
      const target = targets[name];
      if (!target) continue;
      out.push(`${prefix}${name} => ${target.replace(/\\/g, "/")}`);
      continue;
    }
    out.push(line);
  }
  fs.writeFileSync(goModPath, out.join("\n"), "utf8");
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
