// Run Go unit tests for utility output plugins without keeping test files in
// the package directories that npm ships for lazy native builds.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttscDir = path.join(root, "packages", "ttsc");
const packages = ["banner", "paths", "strip"];

for (const name of packages) {
  const source = path.join(root, "packages", name);
  const tests = path.join(root, "tests", "utility-plugins", name);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `ttsc-${name}-go-test-`));
  try {
    fs.cpSync(source, scratch, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        return (
          base !== "go.work" &&
          base !== "go.work.sum" &&
          base !== "node_modules" &&
          !base.endsWith(".tgz")
        );
      },
    });
    fs.cpSync(tests, scratch, { recursive: true });
    writeGoWork(scratch);
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
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function writeGoWork(scratch) {
  const useDirs = [scratch];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);
  fs.writeFileSync(
    path.join(scratch, "go.work"),
    `go 1.26\n\nuse (\n${useDirs.map((dir) => `\t${dir.replace(/\\/g, "/")}`).join("\n")}\n)\n`,
    "utf8",
  );
}

function walkForGoMod(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((entry) => entry.isFile() && entry.name === "go.mod")) {
    out.push(dir);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name === ".cache") continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}
