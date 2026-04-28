// Run the @ttsc/lint Go-side tests.
//
// The lint plugin's go-plugin module imports the in-tree
// `microsoft/typescript-go/shim/*` modules with a v0.0.0 placeholder
// version (matching the rest of ttsc's shim setup). Go workspace mode
// gets confused when validating these placeholders because the public
// proxy doesn't carry the matching multi-module tags. To work around it,
// we mirror the materialization the plugin host does at runtime:
//
//   1. Copy go-plugin/* into a scratch tmpdir.
//   2. Write a go.work that lists every in-tree shim with an *absolute*
//      `use` path.
//   3. Run `go test ./...` in the scratch dir.
//
// Same shape `packages/ttsc/src/source-build.ts` uses; this script is
// the test-only equivalent.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goPluginDir = path.join(root, "packages", "lint", "go-plugin");
const ttscDir = path.join(root, "packages", "ttsc");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-go-test-"));
try {
  // Copy go-plugin source into the scratch dir, skipping go.work files
  // and the build artifacts cache the way materializeScratchDir does.
  const skip = new Set(["go.work", "go.work.sum", "node_modules"]);
  fs.cpSync(goPluginDir, scratch, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)),
  });

  // Discover every in-tree shim module + ttsc itself. Mirrors
  // `findTtscOverlayDirs` from packages/ttsc/src/source-build.ts so
  // workspace resolution sees the same module graph the runtime build
  // does.
  const useDirs = [scratch];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  const shimRoot = path.join(ttscDir, "shim");
  walkForGoMod(shimRoot, useDirs);

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
