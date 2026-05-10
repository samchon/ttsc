// Enforce 100% statement coverage for Go logic packages.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const ttscDir = path.join(root, "packages", "ttsc");
const coverageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-go-coverage-"));

try {
  runTtscCoverage();
  for (const name of ["banner", "paths", "strip"]) {
    runUtilityPluginCoverage(name);
  }
  runLintCoverage();
  runGoTransformerCoverage();
} finally {
  fs.rmSync(coverageRoot, { recursive: true, force: true });
}

function runTtscCoverage() {
  const coverprofile = path.join(coverageRoot, "ttsc.out");
  run(
    "go",
    [
      "test",
      "./cmd/platform",
      "./cmd/ttsc",
      "./driver",
      "./test/...",
      "./utility",
      "-covermode=atomic",
      "-coverpkg=./cmd/platform,./cmd/ttsc,./driver,./utility",
      `-coverprofile=${coverprofile}`,
    ],
    { cwd: ttscDir, env: goEnv() },
  );
  assertFullCoverage("packages/ttsc", coverprofile, { cwd: ttscDir });
}

function runUtilityPluginCoverage(name) {
  const packageDir = path.join(root, "packages", name);
  const workdir = fs.mkdtempSync(path.join(coverageRoot, `${name}-work-`));
  const coverprofile = path.join(coverageRoot, `${name}.out`);
  try {
    const goWork = path.join(workdir, "go.work");
    writeGoWork(goWork, packageDir);
    run(
      "go",
      [
        "test",
        "./test",
        "-covermode=atomic",
        "-coverpkg=./plugin",
        `-coverprofile=${coverprofile}`,
      ],
      {
        cwd: packageDir,
        env: { ...goEnv(), GOWORK: goWork },
      },
    );
    assertFullCoverage(`packages/${name}`, coverprofile, {
      cwd: packageDir,
      env: { ...goEnv(), GOWORK: goWork },
    });
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

function runLintCoverage() {
  const lintPkgDir = path.join(root, "packages", "lint");
  const lintTestsDir = path.join(lintPkgDir, "test");
  const scratch = fs.mkdtempSync(path.join(coverageRoot, "lint-"));
  const coverprofile = path.join(coverageRoot, "lint.out");
  try {
    fs.cpSync(lintPkgDir, scratch, {
      recursive: true,
      filter: (src) =>
        !new Set(["go.work", "go.work.sum", "node_modules", ".cache"]).has(
          path.basename(src),
        ),
    });
    copyGoTestsFlat(lintTestsDir, path.join(scratch, "plugin"));
    const useDirs = [scratch];
    if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
      useDirs.push(ttscDir);
    }
    walkForGoMod(path.join(ttscDir, "shim"), useDirs);
    fs.writeFileSync(
      path.join(scratch, "go.work"),
      `go 1.26\n\nuse (\n${useDirs.map((dir) => `\t${slash(dir)}`).join("\n")}\n)\n`,
      "utf8",
    );
    run(
      "go",
      [
        "test",
        "./plugin",
        "-covermode=atomic",
        "-coverpkg=./plugin",
        `-coverprofile=${coverprofile}`,
      ],
      {
        cwd: scratch,
        env: {
          ...goEnv(),
          TTSC_TSGO_BINARY:
            process.env.TTSC_TSGO_BINARY ?? resolveTsgoBinary(),
          TTSC_TTSX_BINARY:
            process.env.TTSC_TTSX_BINARY ??
            path.join(ttscDir, "lib", "launcher", "ttsx.js"),
        },
      },
    );
    assertFullCoverage("packages/lint", coverprofile, { cwd: scratch });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function runGoTransformerCoverage() {
  const cwd = path.join(root, "tests", "go-transformer");
  const coverprofile = path.join(coverageRoot, "go-transformer.out");
  run(
    "go",
    [
      "test",
      "./...",
      "-covermode=atomic",
      "-coverpkg=./...",
      `-coverprofile=${coverprofile}`,
    ],
    { cwd, env: goEnv() },
  );
  assertFullCoverage("tests/go-transformer", coverprofile, { cwd });
}

function assertFullCoverage(label, coverprofile, options) {
  const result = run("go", ["tool", "cover", "-func", coverprofile], {
    ...options,
    capture: true,
  });
  const lines = result.stdout.trim().split(/\r?\n/);
  const total = lines.find((line) => /\btotal:\s+\(statements\)\s+/.test(line));
  if (total === undefined) {
    throw new Error(`${label}: missing total coverage line`);
  }
  const match = total.match(/(\d+(?:\.\d+)?)%$/);
  if (match === null) {
    throw new Error(`${label}: could not parse total coverage from ${total}`);
  }
  if (Number(match[1]) !== 100) {
    process.stdout.write(result.stdout);
    throw new Error(`${label}: Go logic coverage is ${match[1]}%, expected 100%`);
  }
  console.log(`${label}: Go logic coverage 100.0%`);
}

function run(command, args, options) {
  const result = cp.spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const suffix =
      options.capture && result.stderr ? `\n${result.stderr}` : "";
    throw new Error(
      `${command} ${args.join(" ")} failed with status ${result.status ?? 1}${suffix}`,
    );
  }
  return result;
}

function goEnv() {
  return {
    ...process.env,
    PATH: fs.existsSync(goRoot)
      ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH,
  };
}

function writeGoWork(location, packageDir) {
  const useDirs = [packageDir];
  if (fs.existsSync(path.join(ttscDir, "go.mod"))) {
    useDirs.push(ttscDir);
  }
  walkForGoMod(path.join(ttscDir, "shim"), useDirs);
  fs.writeFileSync(
    location,
    [
      "go 1.26",
      "",
      "use (",
      useDirs.map((dir) => `\t${slash(dir)}`).join("\n"),
      ")",
      "",
      `replace github.com/samchon/ttsc/packages/ttsc v0.0.0 => ${slash(ttscDir)}`,
      "",
    ].join("\n"),
    "utf8",
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
  if (entries.some((entry) => entry.isFile() && entry.name === "go.mod")) {
    out.push(dir);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "node_modules" || entry.name === ".cache") continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}

function resolveTsgoBinary() {
  const packageJson = require.resolve("@typescript/native-preview/package.json", {
    paths: [root],
  });
  const requireFromNativePreview = require("node:module").createRequire(
    packageJson,
  );
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
}

function slash(value) {
  return value.replace(/\\/g, "/");
}
