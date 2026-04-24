const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "../../..");
const testPackageRoot = path.resolve(__dirname, "..");
const projectsRoot = path.resolve(testPackageRoot, "..", "projects");
const ttscBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const ttsxBin = path.join(
  workspaceRoot,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsx.js",
);
const nativeBinary = path.join(
  workspaceRoot,
  "packages",
  `ttsc-${process.platform}-${process.arch}`,
  "bin",
  process.platform === "win32" ? "ttsc.exe" : "ttsc",
);

function createProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-smoke-"));
  writeFiles(root, files);
  return root;
}

function copyProject(name) {
  const source = path.join(projectsRoot, name);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ttsc-${name}-`));
  copyDirectory(source, root);
  return root;
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function writeFiles(root, files) {
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }
}

function tsconfig(compilerOptions, extra = {}) {
  return JSON.stringify({
    compilerOptions,
    include: ["src"],
    ...extra,
  });
}

function commonJsProject(files, options = {}) {
  return createProject({
    "tsconfig.json": tsconfig({
      target: "ES2022",
      module: "commonjs",
      strict: true,
      outDir: "dist",
      rootDir: "src",
      ...options.compilerOptions,
    }, options.config ?? {}),
    ...files,
  });
}

function spawn(command, args, options = {}) {
  const usesNodeLauncher = command === ttscBin || command === ttsxBin;
  const result = child_process.spawnSync(usesNodeLauncher ? process.execPath : command, [
    ...(usesNodeLauncher ? [command] : []),
    ...args,
  ], {
    ...options,
    env: {
      ...process.env,
      TTSC_BINARY: nativeBinary,
      ...options.env,
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
  if (result.error && !result.stderr) {
    result.stderr = result.error.message;
  }
  return result;
}

function runNode(file, options = {}) {
  return spawn(process.execPath, [file], options);
}

module.exports = {
  commonJsProject,
  copyProject,
  createProject,
  nativeBinary,
  projectsRoot,
  runNode,
  spawn,
  testPackageRoot,
  ttscBin,
  ttsxBin,
  tsconfig,
  workspaceRoot,
  writeFiles,
};
