// Run the engine + config Go tests for the lint package.
//
// Tests live under `packages/lint/test/` and are copied next to the package's
// Go linthost library sources in a scratch module. The complete classified
// TypeScript fixture corpus also runs here, without compiling or launching a
// source plugin for each rule. CLI/config/contributor defenses remain separate.
//
// This runner mirrors the materialization `packages/ttsc/src/source-build.ts`
// performs at compile time:
//
//   1. Copy `packages/lint/` into a scratch tmpdir.
//   2. Copy every Go file under `packages/lint/test/` into scratch/linthost.
//      The source tree is categorized for review, but the files are flattened
//      in scratch because they intentionally test unexported linthost-package
//      internals next to the library sources.
//   3. Write a go.work that `use`s every in-tree shim, the lint
//      package itself, and the ttsc package (the latter is required so
//      Go workspace mode can resolve the multi-module placeholder
//      versions the shims declare).
//   4. Prepare the classified fixture projects, then run Go tests once.

const cp = require("node:child_process");
const { createRequire } = require("node:module");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { copyGoTestsFlat } = require("./ci/go-test-overlay.cjs");
const {
  selectLintGoTests,
  writeLintGoSelection,
} = require("./ci/lint-go-test-selection.cjs");
const { writeGoWork } = require("./go-work.cjs");

const root = path.resolve(__dirname, "..");
const windowsBoundary = process.argv.includes("--os-boundaries");
if (windowsBoundary && process.platform !== "win32")
  throw new Error("The Windows kernel boundary batch requires Windows");
const unit = process.env.TTSC_TEST_LAYER === "unit";
const e2e = process.env.TTSC_TEST_LAYER === "e2e";
const direct = unit || windowsBoundary;
const lintPkgDir = path.join(root, "packages", "lint");
const lintTestsDir = path.join(lintPkgDir, "test");
// The OS batch compiles against the SDK of the candidate just installed and
// executed by the preceding smoke step, not a second checkout SDK installation.
const ttscDir = windowsBoundary
  ? installedCandidateSdk()
  : path.join(root, "packages", "ttsc");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttsxBinary =
  process.env.TTSC_TTSX_BINARY ??
  path.join(ttscDir, "lib", "launcher", "ttsx.js");
// Fail loudly in an unbuilt tree instead of letting the config-loader tests
// fail deep inside `go test` with an opaque `Cannot find module '…/ttsx.js'`
// (issue #622). test-go-lint drives the real ttsx launcher, which only exists
// after the ttsc package is built.
if (!direct && !fs.existsSync(ttsxBinary)) {
  throw new Error(
    `ttsc lint Go tests need the ttsx launcher at ${ttsxBinary}, which does not exist.\n` +
      "Build it first with `pnpm --filter ttsc build`, or set TTSC_TTSX_BINARY to an existing launcher.",
  );
}
const tsgoBinary = direct ? "" : resolveTsgoBinary();
const prettierModule = direct ? "" : resolvePrettierModule();

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-lint-go-test-"));
// Native-binary tests copy the scratch module. Keep fixture projects outside it
// so each such build cannot copy hundreds of unrelated sources and links.
const corpusScratch = fs.mkdtempSync(
  path.join(os.tmpdir(), "ttsc-lint-corpus-"),
);
try {
  // Copy the source module into the scratch dir, skipping build artifacts
  // the way materializeScratchDir does.
  const skip = new Set(["go.work", "go.work.sum", "node_modules", ".cache"]);
  fs.cpSync(lintPkgDir, scratch, {
    recursive: true,
    filter: (src) => !skip.has(path.basename(src)),
  });
  const packageFiles = copyGoTestsFlat(
    lintTestsDir,
    path.join(scratch, "linthost"),
    (file) =>
      !windowsBoundary ||
      path
        .relative(lintTestsDir, file)
        .split(path.sep)
        .join("/")
        .startsWith("os-boundaries/windows/") ||
      [
        "config_fixture_helpers_test.go",
        "windows_short_path_windows_test.go",
        "helpers_test.go",
        "behavioral_witness_coverage_test.go",
        "lsp_command_helpers_test.go",
        "lsp_format_buffer_helpers_test.go",
        "lsp_code_action_helpers_test.go",
        "lsp_logical_project_link_helpers_test.go",
      ].includes(path.basename(file)),
  );
  // Repository validation tests stay outside the product package. Overlay
  // them beside the engine only in this disposable Go test module.
  const unitOverlays = new Set([
    "lint_fixture_corpus_test.go",
    "command_format_fixture_corpus_test.go",
    "command_check_preserves_severity_exit_contract_test.go",
  ]);
  const repositoryFiles = copyGoTestsFlat(
    path.join(root, "tests", "test-lint", "go"),
    path.join(scratch, "linthost"),
    (file) =>
      !windowsBoundary && (!e2e || !unitOverlays.has(path.basename(file))),
  );

  // Discover every in-tree module the workspace needs to satisfy:
  //   - the lint package (whose tests we're running),
  //   - packages/ttsc itself (required for shim resolution),
  //   - every shim/* under packages/ttsc with a go.mod.
  // The scratch module is referenced as "." rather than by absolute path:
  // on Windows, Go canonicalizes the temp directory differently than
  // Node's mkdtemp spells it, and the absolute entry fails the workspace
  // membership check ("directory linthost is contained in a module that is
  // not one of the workspace modules").
  const useDirs = ["."];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);

  const env = {
    ...process.env,
    PATH: fs.existsSync(goRoot)
      ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH,
    TTSC_TSGO_BINARY: direct
      ? ""
      : (process.env.TTSC_TSGO_BINARY ?? tsgoBinary),
    TTSC_TTSX_BINARY: direct ? "" : ttsxBinary,
    TTSC_PRETTIER_MODULE: direct
      ? ""
      : (process.env.TTSC_PRETTIER_MODULE ?? prettierModule),
    TTSC_LINT_CORPUS_MANIFEST: path.join(corpusScratch, "corpus.json"),
    TTSC_LINT_FORMAT_FIXTURES: path.join(
      root,
      "tests",
      "test-lint",
      "fixtures",
      "format-projects",
    ),
  };
  const prepared =
    e2e || windowsBoundary
      ? { status: 0 }
      : cp.spawnSync(
          process.execPath,
          [
            "--import",
            pathToFileURL(
              path.join(root, "scripts", "register-typescript-loader.mjs"),
            ).href,
            path.join(root, "scripts", "ci", "prepare-lint-corpus.mts"),
            path.join(corpusScratch, "projects"),
            env.TTSC_LINT_CORPUS_MANIFEST,
          ],
          {
            cwd: path.join(root, "tests", "test-lint"),
            env,
            stdio: "inherit",
            windowsHide: true,
          },
        );
  if (prepared.error) throw prepared.error;
  if (prepared.status !== 0)
    console.error(
      "lint corpus preparation failed; continuing independent engine tests",
    );
  writeGoWork(
    path.join(scratch, "go.work"),
    `use (\n${useDirs.map((d) => `\t${d.replace(/\\/g, "/")}`).join("\n")}\n)\n`,
    env,
  );

  // The original package tests are compiled together because their helpers
  // reach unexported linthost internals. In CI, call every test function once
  // through the owning layer's parent subtest instead of running the whole
  // package again in e2e. Default local test:go still runs the original suite.
  let selection = [];
  if (unit || e2e || windowsBoundary) {
    const layer = windowsBoundary ? "windows" : unit ? "unit" : "e2e";
    const tests = selectLintGoTests(
      lintTestsDir,
      path.join(root, "tests", "test-lint", "go"),
      { packageFiles, repositoryFiles, layer },
    );
    const wrapper = writeLintGoSelection(
      path.join(scratch, "linthost", "lint_layer_selection_test.go"),
      tests[layer],
      layer,
      tests.sources,
    );
    selection = [`-run=^${wrapper}$`];
  }
  const result = cp.spawnSync(
    "go",
    [
      "test",
      "-trimpath",
      "-count=1",
      "-timeout=20m",
      ...selection,
      ...process.argv
        .slice(2)
        .filter((argument) => argument !== "--os-boundaries"),
      "./linthost",
    ],
    {
      cwd: scratch,
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  if (result.error) {
    throw result.error;
  }
  // An exit code, not `process.exit`: exiting here would skip the `finally`
  // that removes the scratch module.
  process.exitCode = prepared.status === 0 ? (result.status ?? 1) : 1;
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(corpusScratch, { recursive: true, force: true });
  if (windowsBoundary)
    fs.rmSync(process.env.TTSC_INSTALLED_SMOKE_ROOT, {
      recursive: true,
      force: true,
    });
}

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

function resolvePrettierModule() {
  try {
    return require.resolve("prettier", { paths: [root] });
  } catch (error) {
    throw new Error(
      `ttsc lint Go tests need the pinned prettier module: ${error.message}`,
      { cause: error },
    );
  }
}

function resolveTsgoBinary() {
  const packageJson = require.resolve("typescript/package.json", {
    paths: [root],
  });
  const requireFromTypeScript = createRequire(packageJson);
  const platformPackageJson = requireFromTypeScript.resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
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
