import child_process from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

export namespace TestProject {
  export const WORKSPACE_ROOT = findWorkspaceRoot(process.cwd());
  export const TEST_PACKAGE_ROOT = path.join(WORKSPACE_ROOT, "tests", "utils");
  export const PROJECTS_ROOT = path.join(WORKSPACE_ROOT, "tests", "projects");
  export const REQUIRE_FROM_TEST = createRequire(
    path.join(TEST_PACKAGE_ROOT, "package.json"),
  );
  export const SOURCE_DIR = path.join(TEST_PACKAGE_ROOT, "src");
  export const TTSC_BIN = path.join(
    WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "ttsc.js",
  );
  export const TTSX_BIN = path.join(
    WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "ttsx.js",
  );
  export const NATIVE_BINARY = path.join(
    WORKSPACE_ROOT,
    "packages",
    `ttsc-${process.platform}-${process.arch}`,
    "bin",
    process.platform === "win32" ? "ttsc.exe" : "ttsc",
  );
  export const TSGO_BINARY = resolveTsgoBinary();

  export function createProject(files: Record<string, string>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-smoke-"));
    writeFiles(root, files);
    return root;
  }

  export function copyProject(name: string) {
    const source = path.join(PROJECTS_ROOT, name);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `ttsc-${name}-`));
    copyDirectory(source, root);
    return root;
  }

  export function copyDirectory(source: string, target: string) {
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

  export function writeFiles(root: string, files: Record<string, string>) {
    for (const [name, contents] of Object.entries(files) as [
      string,
      string,
    ][]) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents, "utf8");
    }
  }

  export function tsconfig(
    compilerOptions: Record<string, unknown>,
    extra: any = {},
  ) {
    return JSON.stringify({
      compilerOptions,
      include: ["src"],
      ...extra,
    });
  }

  export function commonJsProject(
    files: Record<string, string>,
    options: any = {},
  ) {
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

  export function spawn(command: string, args: string[], options: any = {}) {
    const usesNodeLauncher = command === TTSC_BIN || command === TTSX_BIN;
    const result = child_process.spawnSync(
      usesNodeLauncher ? process.execPath : command,
      [...(usesNodeLauncher ? [command] : []), ...args],
      {
        ...options,
        env: {
          ...process.env,
          TTSC_BINARY: NATIVE_BINARY,
          TTSC_TSGO_BINARY: TSGO_BINARY,
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

  export function runNode(file: string, options: any = {}) {
    return spawn(process.execPath, [file], options);
  }

  export function resolveTsgoBinary() {
    const packageJson = REQUIRE_FROM_TEST.resolve(
      "@typescript/native-preview/package.json",
      {
        paths: [WORKSPACE_ROOT],
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
}
