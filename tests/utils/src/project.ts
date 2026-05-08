import child_process from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const workspaceRoot = findWorkspaceRoot(process.cwd());
const testPackageRoot = path.join(workspaceRoot, "tests", "utils");
const projectsRoot = path.join(workspaceRoot, "tests", "projects");
const requireFromTest = createRequire(
  path.join(testPackageRoot, "package.json"),
);
const __dirname = path.join(testPackageRoot, "src");
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
const tsgoBinary = resolveTsgoBinary();

function createProject(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-smoke-"));
  writeFiles(root, files);
  return root;
}

function copyProject(name: string) {
  const source = path.join(projectsRoot, name);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `ttsc-${name}-`));
  copyDirectory(source, root);
  return root;
}

function copyDirectory(source: string, target: string) {
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

function writeFiles(root: string, files: Record<string, string>) {
  for (const [name, contents] of Object.entries(files) as [string, string][]) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents, "utf8");
  }
}

function tsconfig(compilerOptions: Record<string, unknown>, extra: any = {}) {
  return JSON.stringify({
    compilerOptions,
    include: ["src"],
    ...extra,
  });
}

function commonJsProject(files: Record<string, string>, options: any = {}) {
  return createProject({
    "tsconfig.json": tsconfig(
      {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        ...options.compilerOptions,
      },
      options.config ?? {},
    ),
    ...files,
  });
}

function spawn(command: string, args: string[], options: any = {}) {
  const usesNodeLauncher = command === ttscBin || command === ttsxBin;
  const result = child_process.spawnSync(
    usesNodeLauncher ? process.execPath : command,
    [...(usesNodeLauncher ? [command] : []), ...args],
    {
      ...options,
      env: {
        ...process.env,
        TTSC_BINARY: nativeBinary,
        TTSC_TSGO_BINARY: tsgoBinary,
        ...options.env,
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    },
  );
  if (result.error && !result.stderr) {
    result.stderr = result.error.message;
  }
  return result;
}

function runNode(file: string, options: any = {}) {
  return spawn(process.execPath, [file], options);
}

function resolveTsgoBinary() {
  const packageJson = requireFromTest.resolve(
    "@typescript/native-preview/package.json",
    {
      paths: [workspaceRoot],
    },
  );
  const requireFromNativePreview = createRequire(packageJson);
  const platformPackageJson = requireFromNativePreview.resolve(
    `@typescript/native-preview-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
}

function findWorkspaceRoot(start: string): string {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Unable to find workspace root from ${start}`);
    }
    dir = parent;
  }
}

export {
  __dirname,
  child_process,
  commonJsProject,
  copyDirectory,
  copyProject,
  createProject,
  createRequire,
  fs,
  nativeBinary,
  os,
  path,
  projectsRoot,
  requireFromTest,
  resolveTsgoBinary,
  runNode,
  spawn,
  testPackageRoot,
  tsconfig,
  tsgoBinary,
  ttscBin,
  ttsxBin,
  workspaceRoot,
  writeFiles,
};
