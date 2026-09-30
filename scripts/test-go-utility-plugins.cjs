// Run utility function contracts once; retain real CLI and filesystem boundaries.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { writeGoWork } = require("./go-work.cjs");
const { createUtilityTestOverlay } = require("./ci/utility-test-overlay.cjs");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttscDir = path.join(root, "packages", "ttsc");
const packageNames = ["banner", "paths", "strip"];
const layer = process.env.TTSC_TEST_LAYER;
if (layer && layer !== "unit" && layer !== "e2e")
  throw new Error(`unknown TTSC_TEST_LAYER: ${layer}`);

// Physical unit and E2E populations join their shared helper declarations in
// the original module package; no name-prefix selector can misclassify a case.

for (const name of packageNames) {
  const packageDir = path.join(root, "packages", name);
  const workdir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-${name}-go-work-`),
  );
  // Collect every independent package's result. A failed build blocks only
  // that package's tests; cleanup still runs before the next package.
  try {
    const goWork = path.join(workdir, "go.work");
    writeUtilityGoWork(goWork, packageDir);
    const overlay = createUtilityTestOverlay(packageDir, workdir, layer);
    // Build the actual producer once; every surviving command case executes
    // this same binary rather than invoking the Go tool again during tests.
    const env = {
      ...process.env,
      GOWORK: goWork,
      TTSC_UTILITY_TEST_MODULE_ROOT: packageDir,
      PATH: fs.existsSync(goRoot)
        ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
        : process.env.PATH,
    };
    const warm =
      layer === "unit"
        ? null
        : cp.spawnSync("go", [
            "build", "-o", workdir,
            ...(env.TTSC_PLUGIN_COVERDIR
              ? ["-cover", "-covermode=atomic", "-coverpkg=./plugin,./driver"]
              : []),
            "./plugin",
          ], {
            cwd: packageDir,
            env,
            stdio: "inherit",
            windowsHide: true,
          });
    if (warm?.error) {
      throw warm.error;
    }
    if (warm && warm.status !== 0) {
      process.exitCode = warm.status ?? 1;
      continue;
    }
    if (warm)
      env.TTSC_UTILITY_TEST_BINARY = path.join(
        workdir,
        `plugin${process.platform === "win32" ? ".exe" : ""}`,
      );
    const args = ["test", "-count=1", "-overlay", overlay, ...process.argv.slice(2)];
    args.push("./test");
    const result = cp.spawnSync("go", args, {
      cwd: packageDir,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      continue;
    }
  } catch (error) {
    console.error(`utility ${name}:`, error);
    process.exitCode = 1;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

function writeUtilityGoWork(location, packageDir) {
  const useDirs = [packageDir];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);
  // Native separators on purpose: Go's workspace-module matching on Windows
  // rejects forward-slash `use` paths ("directory ... is not one of the
  // workspace modules"), so a slash-normalized go.work breaks every relative
  // package pattern there. POSIX paths are already native.
  writeGoWork(
    location,
    [
      "use (",
      useDirs.map((dir) => `\t${dir}`).join("\n"),
      ")",
      "",
      `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${ttscDir}`,
      "",
    ].join("\n"),
    {
      ...process.env,
      PATH: fs.existsSync(goRoot)
        ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
        : process.env.PATH,
    },
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
