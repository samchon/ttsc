import { E2eProcessTrace } from "./E2eProcessTrace";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

// Every temp dir handed out by this module is tracked here for process-exit
// cleanup unless its owner explicitly retains unresolved process inputs.
// Without this, each test case leaks one or more directories
// under /tmp — across the full suite that runs into thousands of stale dirs
// (the symptom that surfaced as Go-build ENOSPC when /tmp is a small tmpfs).
const TRACKED_TEMP_DIRS = new Set<string>();
const TEMP_IDENTITIES = new Map<string, readonly ITemporaryIdentity[]>();
const RETAINED_TEMP_DIRS = new Set<string>();
let cleanupHookRegistered = false;
let sharedPluginCacheDir: string | undefined;

interface ITemporaryIdentity {
  readonly location: string;
  readonly dev: number;
  readonly ino: number;
  readonly birthtimeMs: number;
}

function ensureCleanupHook(): void {
  if (cleanupHookRegistered) return;
  cleanupHookRegistered = true;
  process.on("exit", () => {
    for (const dir of TRACKED_TEMP_DIRS) {
      if (RETAINED_TEMP_DIRS.has(dir)) continue;
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort: a test that already removed its own dir is fine,
        // and we don't want cleanup failures to mask the real exit code.
      }
    }
    TRACKED_TEMP_DIRS.clear();
    TEMP_IDENTITIES.clear();
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
   * Create a tracked temp directory under the supplied or OS temp root.
   *
   * The returned path is removed on process exit unless unresolved process
   * ownership explicitly retains it or a nested tracked root. This prevents
   * ordinary cases from leaving stale directories under the temporary root.
   */
  export function tmpdir(prefix: string, parent: string = os.tmpdir()): string {
    ensureCleanupHook();
    fs.mkdirSync(parent, { recursive: true });
    const dir = fs.mkdtempSync(path.join(parent, prefix));
    TRACKED_TEMP_DIRS.add(dir);
    const identities: ITemporaryIdentity[] = [];
    let location = fs.realpathSync.native(dir);
    while (true) {
      const stat = fs.lstatSync(location);
      identities.push({ location, dev: stat.dev, ino: stat.ino,
        birthtimeMs: stat.birthtimeMs });
      const next = path.dirname(location);
      if (next === location) break;
      location = next;
    }
    TEMP_IDENTITIES.set(dir, identities);
    return dir;
  }

  /**
   * Keep an allocated root when a process may still read its inputs.
   *
   * Only the exact returned spelling and its original native directory and
   * ancestor identities can transfer out of exit cleanup. Retention is sticky:
   * the caller reports the unresolved descendant and owns later reclamation
   * after joining it. This operation never allocates or follows a foreign root.
   * Tracked ancestors are withheld too, so their recursive cleanup cannot
   * erase retained inputs. Failed identity validation also withdraws cleanup
   * authority over the obsolete spelling without accepting retention identity.
   *
   * @evidence contracts/common.md#principled-implementation Allocation records the physical directory and ancestor identities; retention checks the same native objects before withholding that exact owned root from exit cleanup.
   * @evidence contracts/common.md#clear-and-simple-design One explicit transfer changes only an existing tracked allocation; ordinary allocations retain their exit cleanup behavior.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Aliases, links, replaced or removed directories and untracked inputs cannot acquire retention authority. It does not manufacture process-join evidence.
   * @evidence contracts/common.md#meaningful-documentation States the exact spelling requirement, sticky transfer, diagnostic reason and caller's unresolved reclamation responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation Native realpath and lstat distinguish actual directories from path aliases and reparse links; dev, ino and birth time compare the recorded filesystem identity without assuming case policy.
   * @evidence contracts/performance.md#efficient-algorithms Captures directory ancestors once per allocation. Retention validates that depth and scans the finite tracked allocation population to withhold actual ancestor owners without traversing fixture contents.
   * @evidence contracts/performance.md#reuse-equivalent-work The recorded identity can authorize repeated retention only while every original directory and ancestor remains the same native object; changed identities are refused rather than reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Normal roots remain exit-owned; unresolved roots and tracked ancestors transfer to caller-owned later reclamation. The retained population grows with unresolved allocations, and no automatic release is claimed before descendant closure is established.
   */
  export function retainTemporaryDirectory(root: string, reason: string): void {
    const identities = TEMP_IDENTITIES.get(root);
    if (!TRACKED_TEMP_DIRS.has(root) || !identities || !reason.trim())
      throw new Error("Temporary retention requires an owned allocation and reason: " + root);
    try {
      const rootStat = fs.lstatSync(root);
      if (rootStat.isSymbolicLink() || fs.realpathSync.native(root) !== identities[0]!.location)
        throw new Error("Temporary retention refuses an aliased or linked root: " + root);
      for (const identity of identities) {
        const stat = fs.lstatSync(identity.location);
        if (!stat.isDirectory() || stat.isSymbolicLink() ||
            fs.realpathSync.native(identity.location) !== identity.location ||
            stat.dev !== identity.dev || stat.ino !== identity.ino ||
            stat.birthtimeMs !== identity.birthtimeMs)
          throw new Error("Temporary retention identity changed: " + identity.location);
      }
    } catch (error) {
      // An obsolete allocation spelling cannot authorize later removal of the
      // occupant either. Ancestor allocations must not remove it indirectly.
      withholdTemporaryCleanup(identities, reason, "Cleanup authority refused");
      throw error;
    }
    withholdTemporaryCleanup(identities, reason, "Retained owned temporary directory");
  }

  function withholdTemporaryCleanup(
    identities: readonly ITemporaryIdentity[], reason: string, description: string,
  ): void {
    const ancestors = new Set(identities.map((identity) => identity.location));
    for (const [allocation, recorded] of TEMP_IDENTITIES) {
      if (!ancestors.has(recorded[0]!.location) || RETAINED_TEMP_DIRS.has(allocation)) continue;
      RETAINED_TEMP_DIRS.add(allocation);
      console.error(description + ": " + allocation + "\nReason: " + reason);
    }
  }

  /**
   * Retain an already allocated shared cache without creating one.
   *
   * Environment-selected cache roots belong to their external owner. This
   * operation cannot retain or release those paths; subsequent reuse of an
   * internally retained cache is refused.
   *
   * @evidence contracts/common.md#principled-implementation Only the module's recorded allocation can transfer through native directory identity validation; an environment path supplies no allocation authority.
   * @evidence contracts/common.md#clear-and-simple-design Delegates the single existing cache root to the allocation owner without creating a second lifecycle registry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not allocate replacement work or mutate a foreign cache to conceal unknown descendant completion.
   * @evidence contracts/common.md#meaningful-documentation Describes the no-allocation boundary, foreign ownership and refusal of later internally retained cache reuse.
   */
  export function retainSharedPluginCache(reason: string): void {
    if (sharedPluginCacheDir !== undefined)
      retainTemporaryDirectory(sharedPluginCacheDir, reason);
  }

  /**
   * Return the spelling the filesystem names an existing path by.
   *
   * The OS temp root is often reached through another spelling: `/var` links to
   * `/private/var` on macOS, and Windows can hand out an 8.3 short name such as
   * `RUNNER~1`. ttsc reports a project by its physical location, so a case that
   * compares a reported path with the fixture root it created starts from this
   * spelling. `.native` also expands a Windows short component that plain
   * `fs.realpathSync` can retain.
   */
  export function physicalPath(location: string): string {
    return fs.realpathSync.native(location);
  }

  /**
   * Return the process-wide cache root for ordinary source-plugin scenarios.
   *
   * E2E topology lanes intentionally load helpers from several packages and
   * directories in one process. Keeping this owner here prevents each helper
   * module from allocating a different "shared" cache and paying the same Go
   * plugin build again. Tests that observe cold builds or cache lifecycle still
   * pass their own explicit `tmpdir`.
   * A retained internally owned cache has unresolved readers and cannot serve
   * a new consumer in this process.
   */
  export function sharedPluginCache(): string {
    if (sharedPluginCacheDir !== undefined && RETAINED_TEMP_DIRS.has(sharedPluginCacheDir))
      throw new Error("Shared plugin cache has an unresolved process owner: " + sharedPluginCacheDir);
    return (
      process.env.TTSC_TEST_CACHE_DIR ??
      (sharedPluginCacheDir ??= tmpdir("ttsc-shared-plugin-cache-"))
    );
  }

  /** Share Go objects even when a case deliberately uses a cold plugin root. */
  export function sharedGoBuildCache(): string {
    return (
      process.env.TTSC_GO_CACHE_DIR ||
      process.env.GOCACHE ||
      path.join(sharedPluginCache(), "go-build")
    );
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

  /**
   * Rename `from` to `to`, waiting out a process that still holds the path.
   *
   * Windows refuses a rename while any process has the path or an entry below
   * it open, with `EPERM` for a directory and `EBUSY` for a file, and a watcher
   * under test holds what it observes: a Vite scope held a directory a test
   * renamed on a CI runner. The rename is the test's own step, so it is made
   * rather than abandoned, and only the refusals a held path produces are
   * waited out: any other error, a source that is not there above all, fails at
   * once.
   */
  export async function rename(
    from: string,
    to: string,
    milliseconds = 30_000,
  ): Promise<void> {
    const until = Date.now() + milliseconds;
    for (;;) {
      try {
        fs.renameSync(from, to);
        return;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (
          code === undefined ||
          !HELD_PATH_CODES.has(code) ||
          Date.now() >= until
        ) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }

  /** What a filesystem answers while another process still holds the path. */
  const HELD_PATH_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);

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
   *
   * An override of `undefined` removes the default instead of replacing it, so
   * a case can build a project that declares no `rootDir` (or no `outDir`) at
   * all: `commonJsProject(files, { compilerOptions: { rootDir: undefined } })`.
   * That shape is not a variation on the defaults but the one every default
   * hides — a project whose output layout the compiler has to infer.
   */
  export function commonJsProject(
    files: Record<string, string>,
    options: any = {},
  ) {
    return createProject({
      "tsconfig.json": tsconfig(
        withoutUndeclaredOptions({
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "dist",
          rootDir: "src",
          ...options.compilerOptions,
        }),
        options.config ?? {},
      ),
      ...files,
    });
  }

  /**
   * Drop every key whose value is `undefined`.
   *
   * `commonJsProject` merges its defaults under the caller's overrides, so
   * `undefined` is the only spelling a case has for "this project declares no
   * such option". `JSON.stringify` already omits an `undefined` value, but a
   * fixture whose shape depends on that is a fixture nobody can read; removing
   * the key here makes the removal the helper's stated behaviour rather than a
   * side effect of the serializer.
   */
  function withoutUndeclaredOptions(
    compilerOptions: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(compilerOptions).filter(
        ([, value]) => value !== undefined,
      ),
    );
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
    const result = E2eProcessTrace.spawnSync(
      usesNodeLauncher ? process.execPath : command,
      [...(usesNodeLauncher ? [command] : []), ...args],
      {
        ...options,
        env: {
          ...process.env,
          TTSC_BINARY: NATIVE_BINARY,
          TTSC_TSGO_BINARY: TSGO_BINARY,
          GOCACHE: sharedGoBuildCache(),
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
