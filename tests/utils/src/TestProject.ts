import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { E2eProcessTrace } from "./E2eProcessTrace";

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
 *
 * @evidence contracts/common.md#principled-implementation Native filesystem and process operations construct real isolated compiler projects; recorded allocation identities distinguish owned roots from later aliases or replacements.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns shared cache allocation, temporary-root tracking and the toolchain paths used by fixture consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts These helpers execute real tools and use explicit fixture inputs; retained unknown-reader roots are refused for reuse rather than treated as closed.
 * @evidence contracts/common.md#meaningful-documentation The namespace explains project-shaped roots; member documentation describes cache, cleanup and launcher ownership.
 * @evidence contracts/portability.md#os-neutral-implementation Node native path, realpath and process APIs represent platform paths; native executable suffixes and platform package names are selected at the tool boundary.
 * @evidence contracts/performance.md#efficient-algorithms Fixture materialization scales with file count and bytes, while allocation identity tracking visits only directory ancestors. Exit cleanup visits tracked allocations.
 * @evidence contracts/performance.md#reuse-equivalent-work One process cache shares ordinary native builds while production content witnesses validate artifacts; cold and mutation cases select their own roots.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Tracked allocations last until process exit unless sticky retention transfers unresolved inputs to callers. Shared path strings persist for the process; immediate fixture removal does not prune allocation records.
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
   *
   * @evidence contracts/common.md#principled-implementation mkdtemp creates an exclusive native directory; its physical root and ancestor identities are recorded for later retention validation.
   * @evidence contracts/common.md#clear-and-simple-design Allocation, exit cleanup enrollment and identity capture share one owner, preventing unrelated helpers from independently claiming the same root.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The prefix and parent are caller inputs; native allocation supplies uniqueness instead of a fixture-specific fixed directory.
   * @evidence contracts/common.md#meaningful-documentation The comment states parent selection, exit removal and the unresolved-reader retention exception.
   * @evidence contracts/portability.md#os-neutral-implementation Node mkdir, mkdtemp, native realpath and lstat use the actual filesystem; no case policy is inferred from an OS name.
   * @evidence contracts/performance.md#efficient-algorithms One allocation performs parent creation and O(depth) ancestor observations without reading fixture contents.
   * @evidence contracts/performance.md#reuse-equivalent-work The process exit hook is installed once; allocation identities are captured once and later retention revalidates actual native objects.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The registry retains one entry and ancestor chain per allocation until process exit. Normal roots are removed best-effort on exit; sticky retained roots transfer reclamation to callers. Capture failure after allocation can leave a tracked root until exit.
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
      identities.push({
        location,
        dev: stat.dev,
        ino: stat.ino,
        birthtimeMs: stat.birthtimeMs,
      });
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
   * Tracked ancestors are withheld too, so their recursive cleanup cannot erase
   * retained inputs. Failed identity validation also withdraws cleanup
   * authority over the obsolete spelling without accepting retention identity.
   * Existing one-argument fixture owners use an explicit pending-closure
   * reason; neither that default nor a supplied reason certifies a live process
   * or join.
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
  export function retainTemporaryDirectory(
    root: string,
    reason: string = "Caller retains fixture inputs pending process closure observation",
  ): void {
    const identities = TEMP_IDENTITIES.get(root);
    if (!TRACKED_TEMP_DIRS.has(root) || !identities || !reason.trim())
      throw new Error(
        "Temporary retention requires an owned allocation and reason: " + root,
      );
    try {
      const rootStat = fs.lstatSync(root);
      if (
        rootStat.isSymbolicLink() ||
        fs.realpathSync.native(root) !== identities[0]!.location
      )
        throw new Error(
          "Temporary retention refuses an aliased or linked root: " + root,
        );
      for (const identity of identities) {
        const stat = fs.lstatSync(identity.location);
        if (
          !stat.isDirectory() ||
          stat.isSymbolicLink() ||
          fs.realpathSync.native(identity.location) !== identity.location ||
          stat.dev !== identity.dev ||
          stat.ino !== identity.ino ||
          stat.birthtimeMs !== identity.birthtimeMs
        )
          throw new Error(
            "Temporary retention identity changed: " + identity.location,
          );
      }
    } catch (error) {
      // An obsolete allocation spelling cannot authorize later removal of the
      // occupant either. Ancestor allocations must not remove it indirectly.
      withholdTemporaryCleanup(identities, reason, "Cleanup authority refused");
      throw error;
    }
    withholdTemporaryCleanup(
      identities,
      reason,
      "Retained owned temporary directory",
    );
  }

  function withholdTemporaryCleanup(
    identities: readonly ITemporaryIdentity[],
    reason: string,
    description: string,
  ): void {
    const ancestors = new Set(identities.map((identity) => identity.location));
    for (const [allocation, recorded] of TEMP_IDENTITIES) {
      if (
        !ancestors.has(recorded[0]!.location) ||
        RETAINED_TEMP_DIRS.has(allocation)
      )
        continue;
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
   *
   * @evidence contracts/portability.md#os-neutral-implementation The delegated retention owner checks native directory and ancestor identities; this wrapper does not infer identity from spelling.
   * @evidence contracts/performance.md#efficient-algorithms The wrapper performs one optional delegation; retention cost scales with its recorded ancestors and tracked allocations.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated retention uses the same owned allocation and its original identity checks, not a new cache or closure claim.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No new resource is acquired. Existing cache cleanup transfers to the unresolved reader's caller and future shared-cache consumers are refused.
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
   *
   * @evidence contracts/common.md#principled-implementation Native realpath resolves the actual existing filesystem entry, including native aliases and linked ancestors.
   * @evidence contracts/common.md#clear-and-simple-design One operation owns physical spelling conversion for fixture comparisons.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual resolution failures propagate; no lexical normalization pretends to observe an existing object.
   * @evidence contracts/common.md#meaningful-documentation The native paragraph explains macOS temp aliases and Windows short-name expansion needed for reported-path comparisons.
   * @evidence contracts/portability.md#os-neutral-implementation realpathSync.native obtains platform filesystem spelling without lowercasing or assuming case sensitivity.
   * @evidence contracts/performance.md#efficient-algorithms One native realpath operation follows the supplied path; it does not enumerate fixture contents.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This path observation coordinates no shared computation; each call resolves the current filesystem.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous realpath operation retains no handle, task or cache after return.
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
   * pass their own explicit `tmpdir`. A retained internally owned cache has
   * unresolved readers and cannot serve a new consumer in this process.
   * The first caller can select the existing tmpdir parent contract when its
   * owned project and relative cache arguments must share a filesystem root.
   * An existing allocation or externally selected cache is never relocated.
   *
   * @evidence contracts/common.md#principled-implementation The first ordinary consumer selects an allocated cache unless an external environment root is supplied; retained internally owned inputs refuse later consumers.
   * @evidence contracts/common.md#clear-and-simple-design One process-level slot prevents distinct fixture helpers from allocating separate ordinary native caches.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cold scenarios retain explicit separate roots; the shared slot does not certify artifact validity or substitute cached compiler output.
   * @evidence contracts/common.md#meaningful-documentation The paragraphs explain caller parent selection, external cache precedence and refusal after unresolved ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Native tmpdir and join operations locate the cache; external paths retain their supplied spelling and belong to their external owner.
   * @evidence contracts/performance.md#efficient-algorithms Selection is constant work after the first allocation; first allocation captures directory ancestors through tmpdir.
   * @evidence contracts/performance.md#reuse-equivalent-work Consumers share the same selected cache location. Production native build witnesses, rather than this path memo, establish artifact equivalence. The environment is consulted on every call.
   * @evidence contracts/performance.md#bound-retention-and-release-resources At most one internally allocated cache path is retained per process and is exit-owned unless retained for unresolved readers. External caches are not removed here.
   */
  export function sharedPluginCache(parent?: string): string {
    if (
      sharedPluginCacheDir !== undefined &&
      RETAINED_TEMP_DIRS.has(sharedPluginCacheDir)
    )
      throw new Error(
        "Shared plugin cache has an unresolved process owner: " +
          sharedPluginCacheDir,
      );
    return (
      process.env.TTSC_TEST_CACHE_DIR ??
      (sharedPluginCacheDir ??= tmpdir("ttsc-shared-plugin-cache-", parent))
    );
  }

  /**
   * Share Go objects even when a case deliberately uses a cold plugin root.
   *
   * @evidence contracts/common.md#principled-implementation Explicit test Go cache, inherited GOCACHE and a shared fixture cache form the documented precedence for actual Go object storage.
   * @evidence contracts/common.md#clear-and-simple-design One expression centralizes Go cache selection for compiler-spawning helpers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No Go result or source identity is fabricated; Go owns admission of cached objects.
   * @evidence contracts/common.md#meaningful-documentation The headline explains reuse even when a scenario deliberately chooses a cold plugin cache.
   * @evidence contracts/portability.md#os-neutral-implementation Native join constructs the default subdirectory; explicit environment values are passed to Go without shell rewriting.
   * @evidence contracts/performance.md#efficient-algorithms Selection is constant work aside from first shared-plugin-cache allocation.
   * @evidence contracts/performance.md#reuse-equivalent-work Equivalent Go compilations may share the selected GOCACHE under Go's own object validation; changing the environment changes the selected location.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This returns a path and owns no Go process. The internally allocated parent is exit-owned; externally selected Go cache contents remain externally owned.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation A unique tracked root is populated with the caller's UTF-8 file map, yielding a real writable fixture.
   * @evidence contracts/common.md#clear-and-simple-design Allocation and writing delegate to the existing temporary-root and file-map owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller-authored inputs are written as supplied; no compiler output is synthesized.
   * @evidence contracts/common.md#meaningful-documentation The paragraph states isolation and process-exit lifetime for later output assertions.
   * @evidence contracts/portability.md#os-neutral-implementation Native tmpdir and file-map writing construct filesystem paths; callers must supply trusted relative names.
   * @evidence contracts/performance.md#efficient-algorithms Materialization visits each map entry and writes its content once, with parent creation per entry.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call intentionally allocates distinct mutable fixture inputs and shares no completed materialization.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The root remains tracked until process exit, including when writing fails; the caller may remove it earlier and exit cleanup tolerates absence.
   */
  export function createProject(files: Record<string, string>) {
    const root = tmpdir("ttsc-smoke-");
    writeFiles(root, files);
    return root;
  }

  /**
   * Recursively copy a fixture tree into a writable temp project.
   *
   * Regular-file bytes are copied and directories are recreated. Nested links
   * and nonregular entries are skipped; file metadata is not part of this
   * helper's contract. The caller owns the destination and any partial copy
   * left after an error.
   *
   * @evidence contracts/common.md#principled-implementation Dirent kinds select directories for recursive copy and regular files for byte-preserving copy; other entry kinds are omitted.
   * @evidence contracts/common.md#clear-and-simple-design One recursive copier owns ordinary fixture-tree materialization without dependency-installation policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual source tree supplies every copied byte; no expected output or global filesystem method is replaced.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies recursive copying; nested links and nonregular entries are intentionally not copied, so callers needing them must supply a separate native boundary.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins and copyFile use real entry names; nested symlinks are skipped rather than followed, and copyFile does not promise metadata preservation.
   * @evidence contracts/performance.md#efficient-algorithms Each visited directory is enumerated once and each regular file copied once; recursion space grows with depth and active directory listings.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every call copies current mutable source input; this copier establishes no cross-call cache identity.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous operations settle before return; destination files belong to the caller and partial copies remain after failure. No persistent handle or background task is retained.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation Native rename is attempted until success or the deadline only for the supported held-path error codes; other failures propagate immediately.
   * @evidence contracts/common.md#clear-and-simple-design One retry loop isolates the fixture's native rename step from watcher teardown timing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Retries address actual Windows handle-sharing refusals and remain bounded; absent source and unrelated failures are not hidden.
   * @evidence contracts/common.md#meaningful-documentation The paragraphs identify held-path failures, deadline behavior and the fact that a rename must actually happen.
   * @evidence contracts/portability.md#os-neutral-implementation The filesystem reports EACCES, EBUSY or EPERM at the boundary; native rename and timer delays preserve platform behavior without guessing case policy.
   * @evidence contracts/performance.md#efficient-algorithms Each attempt makes one native rename; attempts scale with actual elapsed refusal time and 25ms delay rather than directory contents.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Rename is an effectful transition and is never cached or shared between requests.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Only one awaited timer exists per failed attempt; success or final failure leaves no pending timer or retained helper state. The caller owns source and destination.
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

  /**
   * Materialize a relative-path file map under the target project root.
   *
   * Keys are trusted authored fixture input. This helper does not reject path
   * traversal or stop existing symlinks from leaving root. Writes replace
   * existing contents sequentially and leave earlier writes after an error.
   *
   * @evidence contracts/common.md#principled-implementation Each trusted map key is joined to the caller root, its parent is created and its UTF-8 contents replace the named file.
   * @evidence contracts/common.md#clear-and-simple-design One loop keeps parent creation and writing beside the fixture map it materializes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The map is authored test input, not product output; no compiler or foreign function is substituted.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies relative file-map materialization; callers own path containment and the destination tree.
   * @evidence contracts/portability.md#os-neutral-implementation Native join and mkdir preserve platform separators. This helper accepts trusted authored keys and does not enforce traversal or symlink containment.
   * @evidence contracts/performance.md#efficient-algorithms Each entry is visited once and each content written once; mkdir may revisit shared parents, with work proportional to total key and content size.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Writes are mutable fixture effects and are not reused across calls; recursive mkdir handles already existing parents natively.
   * @evidence contracts/performance.md#bound-retention-and-release-resources All writes are synchronous; the caller owns created files and partial writes remain on failure. Entry arrays last only through this invocation.
   */
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

  /**
   * Serialize the standard minimal tsconfig shape used by synthetic projects.
   *
   * extra fields override the standard compilerOptions and include fields.
   *
   * @evidence contracts/common.md#principled-implementation Object spread gives explicit extra fields precedence over the standard compilerOptions and include fields before JSON serialization.
   * @evidence contracts/common.md#clear-and-simple-design One serializer owns the minimal synthetic tsconfig shape.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller options control the fixture; no consumer identity or expected compiler result changes serialization.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the minimal config serializer; extra fields may deliberately override include or compilerOptions.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation serializes ordinary JavaScript values and performs no native path or process operation.
   * @evidence contracts/performance.md#efficient-algorithms Serialization visits the supplied JSON-shaped value graph and allocates its encoded text; circular inputs fail through JSON.stringify.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serializes its current options without retained results or shared requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handles or retained state are acquired; the returned string belongs to the caller.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation Defaults are merged below caller compiler options and undefined-valued options are removed, so explicit omission reaches native compiler inference.
   * @evidence contracts/common.md#clear-and-simple-design One fixture constructor delegates JSON serialization and materialization while the private filter owns undefined removal.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts ES2022/CommonJS defaults are the test helper contract; caller overrides preserve cases those defaults would otherwise hide.
   * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain strict defaults and how undefined removes rootDir or outDir.
   * @evidence contracts/portability.md#os-neutral-implementation The delegated project owner uses native filesystem paths; file names remain trusted caller-authored inputs.
   * @evidence contracts/performance.md#efficient-algorithms Option filtering is linear in compiler option count, then serialization and writing scale with the fixture map's bytes.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every invocation creates a distinct mutable project; no authored input or output is reused as a prior fixture result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The delegated project root is tracked for process-exit cleanup and partial preparation remains under that same owner.
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
   *
   * @evidence contracts/common.md#principled-implementation Built JS launchers run through the current Node executable; native commands run directly with explicit argument arrays and toolchain environment defaults.
   * @evidence contracts/common.md#clear-and-simple-design One traced synchronous process boundary centralizes binary selection, environment merging and captured output.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Real child execution supplies status and output; errors are exposed through stderr only when no native stderr exists, and no success is fabricated.
   * @evidence contracts/common.md#meaningful-documentation The paragraph explains Node launcher selection and cross-platform executable semantics; caller env overrides tool defaults.
   * @evidence contracts/portability.md#os-neutral-implementation Node receives separate executable and argv values with windowsHide; the native binary package and .exe suffix are selected explicitly without shell quoting.
   * @evidence contracts/performance.md#efficient-algorithms One process is started per call; captured output is bounded by the 64MiB maxBuffer and actual child work dominates.
   * @evidence contracts/performance.md#reuse-equivalent-work Shared Go cache selection avoids duplicate equivalent object builds under Go's validation; process results are never reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources spawnSync waits for the direct child and closes its pipes; this wrapper does not join arbitrary descendants. Caller owners retain fixture inputs when descendant closure is unknown.
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

  /**
   * Execute a built JavaScript file through the same spawn wrapper.
   *
   * @evidence contracts/common.md#principled-implementation The current Node executable receives the exact built file as its first argument through the existing spawn boundary.
   * @evidence contracts/common.md#clear-and-simple-design One adapter delegates toolchain environment and result capture to spawn.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual JavaScript child executes; the helper does not fabricate its output or status.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies built-file execution through the common spawn wrapper.
   * @evidence contracts/portability.md#os-neutral-implementation process.execPath and separate argv avoid shebang and executable-bit differences on native platforms.
   * @evidence contracts/performance.md#efficient-algorithms One delegation starts one child; output and execution costs follow spawn.
   * @evidence contracts/performance.md#reuse-equivalent-work The common Go-cache selection remains shared; each requested Node execution still runs independently.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous child result returns after direct-child termination; fixture and descendant lifetime remain with the calling case.
   */
  export function runNode(file: string, options: any = {}) {
    return spawn(process.execPath, [file], options);
  }

  /**
   * Resolve the pinned native TypeScript `tsc` binary through the `typescript`
   * package.
   *
   * @evidence contracts/common.md#principled-implementation Resolution starts at the actual typescript manifest and resolves its matching platform dependency before choosing the native tsc file.
   * @evidence contracts/common.md#clear-and-simple-design One resolver owns package-root discovery and platform executable spelling for shared tests.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual package resolution failures propagate; a guessed fallback compiler cannot replace the pinned dependency.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies the pinned native TypeScript executable and package-based resolution.
   * @evidence contracts/portability.md#os-neutral-implementation Platform and architecture select the native package contract, and win32 selects its .exe filename; path construction uses native joins.
   * @evidence contracts/performance.md#efficient-algorithms Two Node package resolutions and a constant number of path operations locate the compiler without scanning the workspace.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The resolver itself caches no result; module constants choose their own stable process input lifetime.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Package resolution and path calculation retain no open handle, child or mutable cache here.
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
