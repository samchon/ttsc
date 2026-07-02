// Run Go unit tests that live beside each utility plugin package.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttscDir = path.join(root, "packages", "ttsc");
const packageNames = ["banner", "paths", "strip"];

for (const name of packageNames) {
  const packageDir = path.join(root, "packages", name);
  const workdir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-${name}-go-work-`),
  );
  try {
    const goWork = path.join(workdir, "go.work");
    writeGoWork(goWork, packageDir);
    // Prewarm the plugin/driver build outside `go test`: the command tests
    // `go run ./plugin` DURING test execution, so on a cold cache (fresh CI
    // runner) the full typescript-go compile counts against the 10-minute
    // test timeout and can single-handedly blow it.
    const warm = cp.spawnSync("go", ["build", "-o", workdir, "./..."], {
      cwd: packageDir,
      env: {
        ...process.env,
        GOWORK: goWork,
        PATH: fs.existsSync(goRoot)
          ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
          : process.env.PATH,
      },
      stdio: "inherit",
      windowsHide: true,
    });
    if (warm.error) {
      throw warm.error;
    }
    if (warm.status !== 0) {
      process.exit(warm.status ?? 1);
    }
    const result = cp.spawnSync("go", ["test", "-count=1", "./test"], {
      cwd: packageDir,
      env: {
        ...process.env,
        GOWORK: goWork,
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
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

function writeGoWork(location, packageDir) {
  const useDirs = [packageDir];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);
  // Native separators on purpose: Go's workspace-module matching on Windows
  // rejects forward-slash `use` paths ("directory ... is not one of the
  // workspace modules"), so a slash-normalized go.work breaks every relative
  // package pattern there. POSIX paths are already native.
  fs.writeFileSync(
    location,
    [
      "go 1.26",
      "",
      "use (",
      useDirs.map((dir) => `\t${dir}`).join("\n"),
      ")",
      "",
      `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${ttscDir}`,
      "",
    ].join("\n"),
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
