import child_process from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

// Every temp dir handed out by this module is tracked here and removed on
// process exit. Without this, each test case leaks one or more directories
// under /tmp — across the full suite that runs into thousands of stale dirs
// (the symptom that surfaced as Go-build ENOSPC when /tmp is a small tmpfs).
const TRACKED_TEMP_DIRS = new Set<string>();
let cleanupHookRegistered = false;

function ensureCleanupHook(): void {
  if (cleanupHookRegistered) return;
  cleanupHookRegistered = true;
  process.on("exit", () => {
    for (const dir of TRACKED_TEMP_DIRS) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort: a test that already removed its own dir is fine,
        // and we don't want cleanup failures to mask the real exit code.
      }
    }
    TRACKED_TEMP_DIRS.clear();
  });
}

/**
 * Filesystem and process helpers for tests that must exercise the real
 * workspace toolchain instead of a mocked compiler API.
 *
 * The helpers deliberately create project-shaped temporary directories because
 * many ttsc and ttsx behaviors depend on tsconfig discovery, package roots,
 * native binary resolution, and plugin-relative paths.
 */
export namespace TestProject {
  /** Repository root discovered from the caller's current working directory. */
  export const WORKSPACE_ROOT = findWorkspaceRoot(process.cwd());
  /** Root of the shared `@ttsc/testing` helper package. */
  export const TEST_PACKAGE_ROOT = path.join(WORKSPACE_ROOT, "tests", "utils");
  /** Canonical fixture tree copied by project-shaped regression tests. */
  export const PROJECTS_ROOT = path.join(WORKSPACE_ROOT, "tests", "projects");
  /** Require function scoped to `tests/utils` so helper deps resolve stably. */
  export const REQUIRE_FROM_TEST = createRequire(
    path.join(TEST_PACKAGE_ROOT, "package.json"),
  );
  /** Source directory scanned by package-local feature runners. */
  export const SOURCE_DIR = path.join(TEST_PACKAGE_ROOT, "src");
  /** Built JavaScript launcher used when tests need the local ttsc command. */
  export const TTSC_BIN = path.join(
    WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "ttsc.js",
  );
  /** Built JavaScript launcher used when tests need the local ttsx command. */
  export const TTSX_BIN = path.join(
    WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "ttsx.js",
  );
  /** Platform package binary built by the current checkout. */
  export const NATIVE_BINARY = path.join(
    WORKSPACE_ROOT,
    "packages",
    `ttsc-${process.platform}-${process.arch}`,
    "bin",
    process.platform === "win32" ? "ttsc.exe" : "ttsc",
  );
  /**
   * Native TypeScript (`tsc`) binary supplied by the pinned `typescript`
   * dependency.
   */
  export const TSGO_BINARY = resolveTsgoBinary();

  /**
   * Create a tracked temp directory under the OS temp root.
   *
   * The returned path is removed on process exit so the suite doesn't pile up
   * stale directories under `/tmp` (each test typically needs a project root
   * plus a plugin cache dir, and there are hundreds of cases).
   */
  export function tmpdir(prefix: string): string {
    ensureCleanupHook();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    TRACKED_TEMP_DIRS.add(dir);
    return dir;
  }

  /**
   * Create an isolated project from an in-memory file map.
   *
   * The project directory survives until the test process exits so assertions
   * can still inspect output files after the command under test returns.
   */
  export function createProject(files: Record<string, string>) {
    const root = tmpdir("ttsc-smoke-");
    writeFiles(root, files);
    return root;
  }

  /**
   * Copy a checked-in fixture project into a writable temp directory.
   *
   * Project fixtures cover behaviors where directory layout matters more than a
   * small synthetic file map, such as entry discovery or package boundaries.
   */
  export function copyProject(name: string) {
    const source = path.join(PROJECTS_ROOT, name);
    const root = tmpdir(`ttsc-${name}-`);
    copyDirectory(source, root);
    return root;
  }

  /** Recursively copy a fixture tree into a writable temp project. */
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

  /** Materialize a relative-path file map under the target project root. */
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

  /** Serialize the standard minimal tsconfig shape used by synthetic projects. */
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

  /**
   * Create a strict CommonJS fixture project with the repo's default test
   * compiler settings, while still allowing individual cases to override the
   * specific tsconfig fields under test.
   */
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

  /**
   * Spawn a command with the checkout's native ttsc and tsgo binaries wired in.
   *
   * Passing launcher paths runs them through the current Node executable, which
   * keeps shebang and executable-bit differences from affecting cross-platform
   * test results.
   */
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

  /** Execute a built JavaScript file through the same spawn wrapper. */
  export function runNode(file: string, options: any = {}) {
    return spawn(process.execPath, [file], options);
  }

  /**
   * Resolve the pinned native TypeScript `tsc` binary through the `typescript`
   * package.
   */
  export function resolveTsgoBinary() {
    const packageJson = REQUIRE_FROM_TEST.resolve("typescript/package.json", {
      paths: [WORKSPACE_ROOT],
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

  /** Walk upward until the monorepo workspace marker is found. */
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
