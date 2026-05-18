// Enforce exact 100% block coverage for Go logic packages.

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
  const unitProfile = path.join(coverageRoot, "ttsc-unit.out");
  const commandCoverDir = path.join(coverageRoot, "ttsc-command");
  const commandMergedDir = path.join(coverageRoot, "ttsc-command-merged");
  const commandProfile = path.join(coverageRoot, "ttsc-command.out");
  const coverprofile = path.join(coverageRoot, "ttsc.out");
  fs.mkdirSync(commandCoverDir, { recursive: true });
  run(
    "go",
    [
      "test",
      "-count=1",
      "./cmd/platform",
      "./cmd/ttsc",
      "./cmd/ttscserver",
      "./driver",
      "./internal/cwd",
      "./internal/lspserver",
      "./test/...",
      "./utility",
      "-covermode=atomic",
      "-coverpkg=./cmd/platform,./cmd/ttsc,./cmd/ttscserver,./driver,./internal/cwd,./internal/lspserver,./utility",
      `-coverprofile=${unitProfile}`,
    ],
    {
      cwd: ttscDir,
      env: {
        ...goEnv(),
        TTSC_NATIVE_COMMAND_COVERDIR: commandCoverDir,
        TTSC_PLATFORM_COMMAND_COVERDIR: commandCoverDir,
        TTSC_TSGO_BINARY: process.env.TTSC_TSGO_BINARY ?? resolveTsgoBinary(),
      },
    },
  );
  convertCommandCoverage(commandCoverDir, commandMergedDir, commandProfile, {
    cwd: ttscDir,
    env: goEnv(),
    label: "packages/ttsc command coverage",
    requiredPaths: ["cmd/platform/", "cmd/ttsc/", "cmd/ttscserver/"],
  });
  mergeCoverprofiles(coverprofile, [unitProfile, commandProfile]);
  assertFullCoverage("packages/ttsc", coverprofile, { cwd: ttscDir });
}

function convertCommandCoverage(inputDir, mergedDir, coverprofile, options) {
  assertCovdataPresent(inputDir, options.label);
  fs.rmSync(mergedDir, { recursive: true, force: true });
  fs.mkdirSync(mergedDir, { recursive: true });
  run(
    "go",
    ["tool", "covdata", "merge", `-i=${inputDir}`, `-o=${mergedDir}`],
    { cwd: options.cwd, env: options.env },
  );
  run(
    "go",
    ["tool", "covdata", "textfmt", `-i=${mergedDir}`, `-o=${coverprofile}`],
    { cwd: options.cwd, env: options.env },
  );
  assertCoverprofileIncludes(coverprofile, options.label, options.requiredPaths);
}

function assertCovdataPresent(dir, label) {
  const files = fs.readdirSync(dir);
  if (!files.some((file) => file.startsWith("covmeta."))) {
    throw new Error(`${label}: missing covmeta files from black-box go run`);
  }
  if (!files.some((file) => file.startsWith("covcounters."))) {
    throw new Error(`${label}: missing covcounters files from black-box go run`);
  }
}

function assertCoverprofileIncludes(coverprofile, label, requiredPaths) {
  const lines = readCoverprofileBlocks(coverprofile);
  for (const requiredPath of requiredPaths) {
    if (!lines.some((line) => line.includes(requiredPath))) {
      throw new Error(
        `${label}: missing black-box coverage block for ${requiredPath}`,
      );
    }
  }
}

function readCoverprofileBlocks(coverprofile) {
  const text = fs.readFileSync(coverprofile, "utf8").trim();
  if (text === "") return [];
  const blocks = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("mode: ")) continue;
    if (!/^.+:\d+\.\d+,\d+\.\d+\s+\d+\s+\d+$/.test(line)) {
      throw new Error(`invalid coverage line: ${line}`);
    }
    blocks.push(line);
  }
  return blocks;
}

function runUtilityPluginCoverage(name) {
  const packageDir = path.join(root, "packages", name);
  const workdir = fs.mkdtempSync(path.join(coverageRoot, `${name}-work-`));
  const unitProfile = path.join(coverageRoot, `${name}-unit.out`);
  const commandCoverDir = path.join(coverageRoot, `${name}-command`);
  const commandMergedDir = path.join(coverageRoot, `${name}-command-merged`);
  const commandProfile = path.join(coverageRoot, `${name}-command.out`);
  const coverprofile = path.join(coverageRoot, `${name}.out`);
  try {
    const goWork = path.join(workdir, "go.work");
    writeGoWork(goWork, packageDir);
    fs.mkdirSync(commandCoverDir, { recursive: true });
    run(
      "go",
      [
        "test",
        "-count=1",
        "./test",
        "-covermode=atomic",
        "-coverpkg=./plugin,./driver",
        `-coverprofile=${unitProfile}`,
      ],
      {
        cwd: packageDir,
        env: {
          ...goEnv(),
          GOWORK: goWork,
          TTSC_PLUGIN_COVERDIR: commandCoverDir,
        },
      },
    );
    convertCommandCoverage(commandCoverDir, commandMergedDir, commandProfile, {
      cwd: packageDir,
      env: { ...goEnv(), GOWORK: goWork },
      label: `packages/${name} command coverage`,
      requiredPaths: ["plugin/", "driver/"],
    });
    mergeCoverprofiles(coverprofile, [unitProfile, commandProfile]);
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
    copyGoTestsFlat(lintTestsDir, path.join(scratch, "linthost"));
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
        "-count=1",
        "./linthost",
        "-covermode=atomic",
        "-coverpkg=./linthost",
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
    reportCoverage("packages/lint", coverprofile, { cwd: scratch });
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
      "-count=1",
      "./transformer",
      "-covermode=atomic",
      "-coverpkg=./transformer",
      `-coverprofile=${coverprofile}`,
    ],
    { cwd, env: goEnv() },
  );
  assertFullCoverage("tests/go-transformer/transformer", coverprofile, { cwd });
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
  const uncovered = readCoverprofileRecords(coverprofile).filter(
    (block) => block.statements > 0 && block.count === 0,
  );
  if (uncovered.length > 0) {
    process.stdout.write(result.stdout);
    const sample = uncovered
      .slice(0, 10)
      .map((block) => `  - ${block.location} (${block.statements} statements)`)
      .join("\n");
    throw new Error(
      `${label}: Go logic coverage has ${uncovered.length} uncovered block(s), expected exact 100%\n${sample}`,
    );
  }
  console.log(`${label}: Go logic coverage 100.0%`);
}

function reportCoverage(label, coverprofile, options) {
  const result = run("go", ["tool", "cover", "-func", coverprofile], {
    ...options,
    capture: true,
  });
  const lines = result.stdout.trim().split(/\r?\n/);
  const total = lines.find((line) => /\btotal:\s+\(statements\)\s+/.test(line));
  if (total === undefined) {
    throw new Error(`${label}: missing total coverage line`);
  }
  console.log(`${label}: ${total.trim()}`);
}

function mergeCoverprofiles(target, profiles) {
  const modes = new Set();
  const blocks = new Map();
  for (const profile of profiles) {
    const text = fs.readFileSync(profile, "utf8").trim();
    if (text === "") continue;
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith("mode: ")) {
        modes.add(line.slice("mode: ".length));
        continue;
      }
      const match = line.match(/^(.+:\d+\.\d+,\d+\.\d+)\s+(\d+)\s+(\d+)$/);
      if (match === null) {
        throw new Error(`invalid coverage line: ${line}`);
      }
      const key = `${match[1]} ${match[2]}`;
      const count = Number(match[3]);
      blocks.set(key, (blocks.get(key) ?? 0) + count);
    }
  }
  if (modes.size === 0) {
    throw new Error("coverage merge received no profiles");
  }
  if (modes.size !== 1) {
    throw new Error(
      `coverage merge received mixed modes: ${[...modes].join(", ")}`,
    );
  }
  const mode = [...modes][0];
  const lines = [`mode: ${mode}`];
  for (const [key, count] of [...blocks.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`${key} ${count}`);
  }
  fs.writeFileSync(target, `${lines.join("\n")}\n`, "utf8");
}

function readCoverprofileRecords(coverprofile) {
  const text = fs.readFileSync(coverprofile, "utf8").trim();
  if (text === "") return [];
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("mode: ")) continue;
    const match = line.match(/^(.+:\d+\.\d+,\d+\.\d+)\s+(\d+)\s+(\d+)$/);
    if (match === null) {
      throw new Error(`invalid coverage line: ${line}`);
    }
    records.push({
      count: Number(match[3]),
      line,
      location: match[1],
      statements: Number(match[2]),
    });
  }
  return records;
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
