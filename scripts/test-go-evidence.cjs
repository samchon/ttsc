// Run the Go rule tests for `@ttsc/evidence`.
//
// This runner is deliberately thinner than `test-go-lint.cjs`. That one has to
// materialize a scratch module because the lint tests reach unexported
// `linthost` internals and must sit beside the library sources. The evidence
// rules are an ordinary Go package with its own tests, and the package already
// carries a `go.mod` whose `replace` directives point at the sibling packages
// in this workspace, so `go test ./native/` compiles them against the `ttsc`
// and `@ttsc/lint` sources in this tree rather than a published release.
//
// That `go.mod` sits one level above `native/` on purpose: ttsc copies the
// directory a contributor's `source` names into `@ttsc/lint`'s own module and
// rejects a `go.mod` inside it. The file exists for tooling like this runner
// and `gopls`, never for the build.
//
// The Windows --os-boundaries population instead binds the retained installed
// CLI consumer's SDK and shim modules through explicit workspace replacements.
// Repository tooling modules remain local, but cannot substitute checkout SDK
// sources for that installed boundary.

const cp = require("node:child_process");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const { writeGoWork } = require("./go-work.cjs");
const os = require("node:os");
const path = require("node:path");
const { walkForGoFiles } = require("./ci/go-test-overlay.cjs");
const {
  selectEvidenceGoTests,
  evidenceGoSelectionSource,
} = require("./ci/evidence-go-test-selection.cjs");

const root = path.resolve(__dirname, "..");
const packageDir = path.join(root, "packages", "evidence");

function main() {
  const windowsBoundary = process.argv.includes("--os-boundaries");
  if (windowsBoundary && process.platform !== "win32")
    throw new Error("The Windows kernel boundary batch requires Windows");
  const requestedLayer = process.env.TTSC_TEST_LAYER;
  if (requestedLayer && requestedLayer !== "unit" && requestedLayer !== "e2e")
    throw new Error(`unknown TTSC_TEST_LAYER: ${requestedLayer}`);
  const sdk = windowsBoundary ? installedCandidateSdk() : undefined;
  const testDirectory = sdk ? fs.realpathSync.native(packageDir) : packageDir;
  const layer = windowsBoundary ? "windows" : requestedLayer;
  if (
    layer &&
    process.argv.slice(2).some((argument) => /^-(run|skip)(=|$)/.test(argument))
  )
    throw new Error(
      "Named Go focus flags cannot override an explicitly owned Evidence population",
    );
  const selection = [];
  if (!fs.existsSync(path.join(packageDir, "native"))) {
    console.error(
      "test-go-evidence: packages/evidence/native is missing; nothing to run.",
    );
    process.exit(1);
  }
  // Repository-only tests join the same Go process through a virtual overlay.
  // No test or source file is written into the protected product package.
  const scratch = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-evidence-go-test-"),
  );
  try {
    const env = { ...process.env };
    if (sdk) {
      const modules = [
        testDirectory,
        fs.realpathSync.native(path.join(root, "packages", "lint")),
      ];
      const sdkModules = [sdk];
      function findModules(directory) {
        if (fs.existsSync(path.join(directory, "go.mod")))
          sdkModules.push(directory);
        for (const entry of fs.readdirSync(directory, { withFileTypes: true }))
          if (entry.isDirectory())
            findModules(path.join(directory, entry.name));
      }
      findModules(path.join(sdk, "shim"));
      // The repo tooling module replaces shims with checkout paths. Explicit
      // workspace replacements bind every SDK module to the installed receipt;
      // these dependencies must not also become workspace main modules.
      const identities = new Set();
      const bindings = sdkModules.map((directory) => {
        const source = fs.readFileSync(path.join(directory, "go.mod"), "utf8");
        const identity = /^module\s+(\S+)\s*$/m.exec(source)?.[1];
        if (!identity || identities.has(identity))
          throw new Error(`Installed SDK module identity is missing or duplicated: ${directory}`);
        if (directory === sdk
          ? identity !== "github.com/samchon/ttsc/packages/ttsc"
          : !identity.startsWith("github.com/microsoft/typescript-go/shim/"))
          throw new Error(`Unexpected installed SDK module identity: ${identity}`);
        identities.add(identity);
        return `${identity} => ${JSON.stringify(directory.split(path.sep).join("/"))}`;
      });
      // Missing installed modules must fail before Go can use a tooling
      // module's checkout replacement for the same declared dependency.
      for (const directory of [...modules, ...sdkModules]) {
        const declaration = fs.readFileSync(path.join(directory, "go.mod"), "utf8")
          .split("\n").map((line) => line.split("//")[0]).join("\n");
        for (const identity of declaration.match(/\bgithub\.com\/microsoft\/typescript-go\/shim\/[\w./-]+/g) ?? [])
          if (!identities.has(identity))
            throw new Error(`Installed SDK does not provide declared shim module: ${identity}`);
      }
      console.log(`Evidence Windows SDK: ${identities.size} authoritative installed module bindings`);
      env.GOWORK = path.join(scratch, "go.work");
      // Go compares main-module roots with its native absolute cwd spelling.
      // Absolute slash paths and 8.3 aliases fail that membership comparison
      // even when they name the same directory. Dependency replacements are
      // resolved separately and keep their existing installed SDK bindings.
      writeGoWork(
        env.GOWORK,
        `use (\n${modules.map((directory) => JSON.stringify(directory)).join("\n")}\n)\nreplace (\n${bindings.join("\n")}\n)\n`,
        env,
      );
    }
    const replace = {};
    const inputs = [];
    const capturedDirectory = path.join(scratch, "captured");
    fs.mkdirSync(capturedDirectory);
    const capture = (file, target, owner) => {
      const source = fs.readFileSync(file, "utf8");
      const captured = path.join(capturedDirectory, path.basename(file));
      if (fs.existsSync(captured))
        throw new Error(`evidence Go captured-source collision: ${file}`);
      fs.writeFileSync(captured, source);
      replace[target] = captured;
      inputs.push({ file: path.basename(file), source, layer: owner });
    };
    for (const file of walkForGoFiles(path.join(testDirectory, "native"))) {
      if (!file.endsWith("_test.go")) continue;
      capture(
        file,
        file,
        file.endsWith("_windows_test.go") ? "windows" : "unit",
      );
    }
    for (const file of walkForGoFiles(
      path.join(packageDir, "test", "e2e"),
    )) {
      const target = path.join(testDirectory, "native", path.basename(file));
      if (fs.existsSync(target) || Object.hasOwn(replace, target))
        throw new Error(`evidence Go overlay collision: ${target}`);
      capture(file, target, "e2e");
    }
    if (layer) {
      const cases = selectEvidenceGoTests(inputs);
      if (cases[layer].length === 0) {
        console.log(`Evidence Go ${layer}: no cases in this population`);
        return;
      }
      const generated = evidenceGoSelectionSource(
        cases[layer],
        layer,
        cases.sources,
      );
      const wrapperFile = path.join(
        scratch,
        "evidence_layer_selection_test.go",
      );
      fs.writeFileSync(wrapperFile, generated.source);
      replace[path.join(testDirectory, "native", path.basename(wrapperFile))] =
        wrapperFile;
      selection.push(`-run=^${generated.wrapper}$`);
    }
    const overlay = path.join(scratch, "overlay.json");
    fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
    const result = cp.spawnSync(
      "go",
      [
        "test",
        "-count=1",
        "-overlay",
        overlay,
        ...selection,
        ...process.argv
          .slice(2)
          .filter((argument) => argument !== "--os-boundaries"),
        "./native/",
      ],
      { cwd: testDirectory, env, stdio: "inherit", windowsHide: true },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// The lint boundary runner owns final consumer cleanup after both independent
// OS batches finish. Evidence uses this candidate without deleting it.
function installedCandidateSdk() {
  const consumer = process.env.TTSC_INSTALLED_SMOKE_ROOT;
  if (
    !consumer ||
    fs.readFileSync(path.join(consumer, ".ttsc-cli-smoke"), "utf8") !== root
  )
    throw new Error(
      "Windows boundaries require the preceding owned installed CLI consumer",
    );
  const physicalConsumer = fs.realpathSync.native(consumer);
  if (
    path.dirname(physicalConsumer).toLowerCase() !==
      fs.realpathSync.native(os.tmpdir()).toLowerCase() ||
    !path.basename(physicalConsumer).startsWith("ttsc-cli-smoke-")
  )
    throw new Error(
      "The installed CLI consumer must be an owned direct temporary directory",
    );
  const sdk = path.dirname(
    createRequire(path.join(consumer, "package.json")).resolve(
      "ttsc/package.json",
    ),
  );
  for (const entry of ["go.mod", "driver", "shim"])
    if (!fs.existsSync(path.join(sdk, entry)))
      throw new Error(`Installed candidate SDK is missing ${entry}`);
  return sdk;
}

main();
