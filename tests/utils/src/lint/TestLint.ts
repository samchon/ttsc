import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { E2eProcessTrace } from "../E2eProcessTrace";
import {
  getNativeLintProducer,
  linkNativeLintPackage,
} from "../NativeLintProducer";
import { TestProject } from "../TestProject";

// Spawn the real `ttsc` binary against an isolated TypeScript fixture
// and parse the rendered stderr diagnostics into structured records.
//
// Each rule's e2e test passes one supported TypeScript source file (the
// violation case) and
// a rules-map. The helper:
//   1. mkdtemp's a fixture project with the supplied source at the selected
//      path (default `src/main.ts`) and a synthesized `tsconfig.json`.
//   2. Symlinks `node_modules/@ttsc/lint` to the workspace package so
//      the plugin resolver finds it the same way it would for an npm
//      install.
//   3. Spawns `ttsc --noEmit --cwd <tmpdir>`, sharing a single
//      TTSC_CACHE_DIR across calls so the Go plugin builds once per
//      test run, not per case.
//   4. Strips ANSI escapes from stderr and parses the
//      `path:LINE:COL - <category> TS<code>: [<rule>] <message>` banner
//      tsgo's renderer prints.
//
// Tests assert on the parsed records. Anything stderr-shaped that
// doesn't match the banner regex is preserved as `result.stderr` so
// failure messages can include the raw output.

const TESTING_PACKAGE_ROOT = TestProject.TEST_PACKAGE_ROOT;
const TTSC_BIN = path.join(
  TestProject.WORKSPACE_ROOT,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const TTSX_BIN = path.join(
  TestProject.WORKSPACE_ROOT,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsx.js",
);
const LINT_PACKAGE_DIR = path.join(
  TestProject.WORKSPACE_ROOT,
  "packages",
  "lint",
);

// The fixture tmpdir doesn't `pnpm install` its own deps — that would be
// far too slow. Instead we resolve the native `tsc` binary from the workspace
// once and forward it to every spawned ttsc via env vars (matches the
// shared testing project helper's strategy).
const TSGO_BINARY = (function resolveTsgoBinary() {
  const packageJson = TestProject.REQUIRE_FROM_TEST.resolve(
    "typescript/package.json",
    { paths: [TestProject.WORKSPACE_ROOT] },
  );
  const requireFromTypeScript = createRequire(packageJson);
  const platformPackageJson = requireFromTypeScript.resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
})();

// Plugin builds (Go) take ~1-2s the first time; share the cache dir
// across the whole test run so subsequent cases reuse the binary. The
// shared TestProject cleanup hook removes it on process exit.
const SHARED_CACHE_DIR = TestProject.sharedPluginCache();

/**
 * Prepare real lint consumer projects and parse their native command output.
 *
 * Configuration and package links remain actual fixture inputs. Manual project
 * handles support source edits between commands; run owns a single prepare,
 * execute and remove sequence. Cleanup requires callers to have finished every
 * reader, because synchronous launcher completion alone does not join arbitrary
 * descendants. Structured diagnostics contain recognized banners only; raw
 * stderr remains available for unmatched text and continuation lines.
 *
 * @evidence contracts/common.md#principled-implementation Authored fixture projects invoke the real lint compiler and parse its rendered diagnostic banners rather than directly calling rule logic.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns fixture input validation, preparation, command execution and normalized result types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Rules are supplied through actual lint configuration files; package links and native execution remain real boundaries.
 * @evidence contracts/common.md#meaningful-documentation The namespace paragraph and members describe fixture ownership, actual command execution and renderer parsing limits.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and process arguments are separate from portable authored source keys; native compiler package and .exe selection occur at explicit boundaries.
 * @evidence contracts/performance.md#efficient-algorithms Preparation visits authored files and validates target collisions; parsing scans stderr once. Native compilation dominates execution and uses shared caches.
 * @evidence contracts/performance.md#reuse-equivalent-work One process-wide native cache is shared under product build witnesses; project sources and diagnostic outcomes remain per invocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources TestProject tracks ordinary temporary roots; returned project cleanup owns explicit removal. Synchronous launcher termination does not prove arbitrary descendant closure, which this older helper does not independently join.
 */
export namespace TestLint {
  /**
   * Normalized severities produced by the native lint plugin.
   *
   * @evidence contracts/common.md#principled-implementation The literal union records the renderer's two normalized severity outcomes, warn and error.
   * @evidence contracts/common.md#clear-and-simple-design A named union is shared by diagnostic records and accepted config spellings.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation admits only supported normalized values rather than a test-specific arbitrary severity.
   * @evidence contracts/common.md#meaningful-documentation The native comment identifies normalized native lint severities.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation TestLint.LintSeverity describes values without addressing a native filesystem or process boundary.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.LintSeverity defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.LintSeverity defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.LintSeverity carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export type LintSeverity = "warn" | "error";
  /**
   * User-facing rule config severities accepted in test tsconfig snippets.
   *
   * @evidence contracts/common.md#principled-implementation The union adds off and warning to normalized severities because fixture configuration accepts those spellings.
   * @evidence contracts/common.md#clear-and-simple-design A separate input union keeps accepted configuration values distinct from normalized output.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Aliases describe the supported config contract rather than silently coercing all input to one severity.
   * @evidence contracts/common.md#meaningful-documentation The native comment identifies user-facing severities in test configuration.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation TestLint.LintRuleConfigSeverity describes values without addressing a native filesystem or process boundary.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.LintRuleConfigSeverity defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.LintRuleConfigSeverity defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.LintRuleConfigSeverity carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export type LintRuleConfigSeverity = "off" | "warning" | LintSeverity;
  /**
   * One `rules` map entry: a bare severity or the `[severity, options]` tuple
   * the lint config format accepts for option-bearing rules.
   *
   * @evidence contracts/common.md#principled-implementation A severity or readonly two-element tuple represents bare rules and option-bearing rules without losing the options value.
   * @evidence contracts/common.md#clear-and-simple-design One union captures the two accepted rule-entry shapes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown options remain caller input for real validation instead of a prevalidated or fabricated rule result.
   * @evidence contracts/common.md#meaningful-documentation The paragraph explains bare severity versus severity/options tuple.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation TestLint.LintRuleConfigEntry describes values without addressing a native filesystem or process boundary.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.LintRuleConfigEntry defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.LintRuleConfigEntry defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.LintRuleConfigEntry carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export type LintRuleConfigEntry =
    | LintRuleConfigSeverity
    | readonly [LintRuleConfigSeverity, unknown];

  /**
   * Parsed representation of one rendered lint diagnostic.
   *
   * @evidence contracts/common.md#principled-implementation A diagnostic record preserves the parsed source location, normalized severity, rule identifier and message as separate fields.
   * @evidence contracts/common.md#clear-and-simple-design The record supports assertions on one renderer finding without conflating process status and text.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The fields describe parsed observed output, not an expected compiler result.
   * @evidence contracts/common.md#meaningful-documentation Field comments identify one-based renderer coordinates, native source spelling and normalized severity.
   * @evidence contracts/portability.md#os-neutral-implementation File text preserves the renderer's source path spelling; coordinates are renderer positions and do not establish native file identity.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.ILintDiagnostic defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.ILintDiagnostic defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.ILintDiagnostic carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export interface ILintDiagnostic {
    /** Source filename as written by the renderer, without native identity proof. */
    file: string;

    /** One-based source line from the diagnostic banner. */
    line: number;

    /** One-based source column from the diagnostic banner. */
    column: number;

    /** Renderer severity normalized from warning to warn. */
    severity: LintSeverity;

    /** Rule identifier between the banner's square brackets. */
    rule: string;

    /** Trimmed banner message, excluding later continuation lines. */
    message: string;
  }

  /**
   * Inputs needed to synthesize and execute one lint fixture project.
   *
   * The tsconfig plugin entry for `@ttsc/lint` carries no rule surface — it
   * only optionally points at a config file via `configFile`. A test supplies
   * its rules one of two ways:
   *
   * - `rules` — the helper writes a `lint.config.json` whose `rules` map is the
   *   given severity map; the sidecar discovers it.
   * - `extraSources` with a `lint.config.*` file — for config-loader and
   *   contributor scenarios. Set `pluginConfig: { configFile: "./path" }` to
   *   name the file explicitly, or omit `pluginConfig` to rely on discovery.
   *
   * @evidence contracts/common.md#principled-implementation The options represent source stimulus, config overrides and real dependency choices, while optional projectRoot transfers a disposable root.
   * @evidence contracts/common.md#clear-and-simple-design One fixture input contract distinguishes main source, additional files, plugin configuration and package links.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller supplies actual config/source inputs; nativeProducer explicitly selects workspace or verified snapshot without fabricating a binary.
   * @evidence contracts/common.md#meaningful-documentation The paragraphs and fields explain config-file discovery, source inclusion, root disposal and producer choice.
   * @evidence contracts/portability.md#os-neutral-implementation Portable relative source keys remain distinct from a native disposable root; linked package names are validated before native joins and links.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.IRunLintOptions defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.IRunLintOptions defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.IRunLintOptions carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export interface IRunLintOptions {
    /** Human-readable case name used in the allocated directory prefix. */
    name: string;

    /** Authored main TypeScript source written verbatim at sourcePath. */
    source: string;

    /**
     * Project-root-relative path the main `source` is written to (default
     * `src/main.ts`). Path-sensitive rules (filename conventions, directory
     * layouts) use it to give the fixture its logical filename. The path must
     * stay inside `src/` so the synthesized tsconfig's `rootDir`/`include`
     * still cover it.
     */
    sourcePath?: string;

    /** Optional nonexistent or empty disposable root under the OS temp dir. */
    projectRoot?: string;

    /**
     * Explicit immutable producer reuse; source/cache mutation cases use
     * workspace.
     */
    nativeProducer?: "workspace" | "snapshot";

    /** Optional rule map written to a discoverable lint.config.json. */
    rules?: Record<string, LintRuleConfigEntry>;

    /** Actual descriptor fields, normally an optional configFile override. */
    pluginConfig?: Record<string, unknown>;

    /** Trusted authored extra files under validated portable relative targets. */
    extraSources?: Record<string, string>;

    /** Actual installed packages linked by npm package name into the fixture. */
    linkNodeModules?: string[];
  }

  /**
   * Temporary project handle returned when a test needs manual lifecycle
   * control.
   *
   * @evidence contracts/common.md#principled-implementation The handle names the actual temporary project and a synchronous request to remove it.
   * @evidence contracts/common.md#clear-and-simple-design One path and one cleanup operation carry caller-controlled fixture lifetime.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The cleanup handle requests removal and does not certify process-reader closure.
   * @evidence contracts/common.md#meaningful-documentation The comment and fields state manual lifecycle control and removal responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation tmpdir is a native directory path; the implementation delegates removal to Node filesystem APIs.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.IRunLintProject defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.IRunLintProject defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.IRunLintProject carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export interface IRunLintProject {
    /** Native project root whose writable contents and removal the caller owns. */
    tmpdir: string;

    /**
     * Remove the project after every reader using its inputs has finished.
     *
     * This synchronous request does not join descendant processes. Removal
     * failures propagate, and calling it after a direct launcher returns is
     * safe only when the caller also knows no descendant retains the inputs.
     *
     * @evidence contracts/common.md#principled-implementation The synchronous signature requests recursive removal of the returned fixture root.
     * @evidence contracts/common.md#clear-and-simple-design The project handle exposes release without exposing preparation internals.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts This older handle does not independently join descendant readers; callers must establish release safety before invoking it.
     * @evidence contracts/common.md#meaningful-documentation The method comment describes explicit project removal after the caller's readers finish.
     * @evidence contracts/portability.md#os-neutral-implementation Node native recursive removal handles the platform directory tree; this signature grants no authority over unowned roots.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature itself specifies no removal traversal algorithm.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work Removal is an effect and cannot be shared as a computed result.
     * @evidence contracts/performance.md#bound-retention-and-release-resources The returned project owns its root and removes it on cleanup; failure remains observable. Direct launcher completion alone does not prove descendants released the tree.
     */
    cleanup(): void;
  }

  /**
   * Raw process result plus diagnostics parsed from stderr.
   *
   * @evidence contracts/common.md#principled-implementation The result separates ordinary numeric status, raw stderr and parsed lint findings; unavailable native status is normalized to failure by runProject.
   * @evidence contracts/common.md#clear-and-simple-design One record supports both precise parsed assertions and raw failure reports.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Parsed findings cannot replace exit-status assertions; unparseable text remains available in stderr.
   * @evidence contracts/common.md#meaningful-documentation The comment and fields identify raw text, normalized failure status and banner-only diagnostic parsing.
   * @evidence contracts/portability.md#os-neutral-implementation Numeric status is a helper projection of Node's nullable native status; this type does not preserve signal or PID and cannot certify descendant closure.
   * @evidenceExclude contracts/performance.md#efficient-algorithms TestLint.IRunLintResult defines a representation; it chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work TestLint.IRunLintResult defines no computation-sharing or invalidation policy.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TestLint.IRunLintResult carries data or signatures; acquisition and release remain with the implementing operation.
   */
  export interface IRunLintResult {
    /** Native exit status, or 1 when Node supplied no ordinary numeric status. */
    status: number;

    /** Unmodified captured stderr, including text the banner parser omits. */
    stderr: string;

    /** Recognized lint banners in rendered order; continuation lines are omitted. */
    diagnostics: ILintDiagnostic[];
  }

  /**
   * Create, run, and remove a one-off lint fixture project.
   *
   * For processes that can retain descendant readers, use a manual project
   * handle and establish reader closure before removal. This convenience owner
   * has no independent descendant join; a cleanup exception replaces an earlier
   * operation exception under JavaScript finally semantics.
   *
   * @evidence contracts/common.md#principled-implementation Project preparation precedes the real synchronous compiler call and finally always invokes the returned cleanup owner.
   * @evidence contracts/common.md#clear-and-simple-design One convenience operation composes the lower-level create and run owners without duplicating fixture policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual compiler output supplies the result; this helper neither retries failures nor synthesizes diagnostics.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the create/run/remove lifecycle; manual reuse belongs to the lower-level project handle.
   * @evidence contracts/portability.md#os-neutral-implementation Native preparation and command execution are delegated to their explicit owners with argv arrays and filesystem APIs.
   * @evidence contracts/performance.md#efficient-algorithms One project and one compiler invocation are requested; work scales with source preparation and actual native compilation.
   * @evidence contracts/performance.md#reuse-equivalent-work The existing shared native/Go caches may serve equivalent compiler work; mutable project files and command outcomes are never reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally removes the fixture after the direct synchronous call. This helper has no independent descendant join, and a cleanup failure can replace an earlier compiler exception.
   */
  export function run(options: IRunLintOptions): IRunLintResult {
    const project = createProject(options);
    try {
      return runProject(project.tmpdir);
    } finally {
      project.cleanup();
    }
  }

  /**
   * Create a temporary lint project and link the workspace lint package into
   * it.
   *
   * Some config tests need to mutate files or run multiple commands, so this
   * lower-level helper returns a cleanup handle instead of running
   * immediately.
   *
   * Targets are validated before writes. A caller-supplied root must be empty
   * and strictly below the native temp root. Preparation failure attempts to
   * remove its partial tree; cleanup errors can replace the original failure.
   *
   * @evidence contracts/common.md#principled-implementation Validated portable targets and disposable roots are established before writing; real config/source files and package links form the actual lint consumer.
   * @evidence contracts/common.md#clear-and-simple-design Private path-validation helpers own collision and containment policy; one preparation function owns writes and its cleanup handle.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Rules remain in real lint.config files, snapshots are explicit and foreign global filesystem/process methods are not replaced.
   * @evidence contracts/common.md#meaningful-documentation The paragraph and input fields explain mutable project reuse, config discovery and disposable-root requirements.
   * @evidence contracts/portability.md#os-neutral-implementation Native roots are canonicalized through existing ancestors, while portable source keys reject Windows aliases, escapes and invalid suffix casing on every platform. Links use native filesystem APIs.
   * @evidence contracts/performance.md#efficient-algorithms Pairwise target validation keeps alias and ancestor diagnostics direct for small authored fixture maps, with quadratic comparisons in file count and path-text costs. Writes visit each source once and link installed dependencies instead of copying their trees; no large-project indexing is promised.
   * @evidence contracts/performance.md#reuse-equivalent-work Compatible snapshot consumers explicitly borrow the verified lint producer and shared native cache. Every project's source/config population is materialized independently.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned root belongs to its cleanup handle; failed preparation attempts immediate removal and ordinary allocated roots remain exit-tracked. A cleanup failure can replace the preparation error; this owner starts no process.
   */
  export function createProject(options: IRunLintOptions): IRunLintProject {
    const {
      name,
      source,
      sourcePath,
      projectRoot,
      rules,
      pluginConfig,
      extraSources,
      linkNodeModules,
    } = options;
    const linkedNodeModules = resolveLinkedNodeModules(linkNodeModules);
    const mainSourcePath = resolveMainSourcePath(
      sourcePath ?? path.posix.join("src", "main.ts"),
    );
    const resolvedExtraSources = resolveExtraSourcePaths(mainSourcePath, {
      extraSources,
      linkedNodeModulePaths: linkedNodeModules.map(
        ({ relativePath }) => relativePath,
      ),
      writesGeneratedLintConfig: rules !== undefined,
    });
    if (projectRoot !== undefined) {
      assertDisposableProjectRoot(projectRoot);
    }
    const tmpdir =
      projectRoot ??
      TestProject.tmpdir(`ttsc-lint-case-${sanitizeForFsName(name)}-`);
    try {
      // The tsconfig plugin entry never carries rules: it is empty, or
      // optionally names a config file via `configFile`. When a test uses the
      // `rules` shorthand, materialize a discoverable `lint.config.json`.
      writeFixtureProject(
        tmpdir,
        source,
        pluginConfig ?? {},
        mainSourcePath,
        resolvedExtraSources.map(([relativePath]) => relativePath),
      );
      for (const [relativePath, content] of resolvedExtraSources) {
        const target = path.join(tmpdir, relativePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, "utf8");
      }
      if (rules !== undefined) {
        fs.writeFileSync(
          path.join(tmpdir, "lint.config.json"),
          JSON.stringify({ rules }, null, 2),
          "utf8",
        );
      }
      seedNodeModulesLink(tmpdir, options.nativeProducer);
      for (const linkedNodeModule of linkedNodeModules) {
        linkNodeModulePackage(tmpdir, linkedNodeModule);
      }
      return {
        tmpdir,
        cleanup: () => fs.rmSync(tmpdir, { recursive: true, force: true }),
      };
    } catch (error) {
      fs.rmSync(tmpdir, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Run ttsc in lint mode against an already materialized fixture project.
   *
   * @evidence contracts/common.md#principled-implementation The current Node runtime runs the built ttsc launcher with the actual fixture cwd, compiler override and noEmit guard; stderr is then parsed without hiding raw text.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous boundary centralizes environment selection and result normalization.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual child status and stderr drive the result; unavailable status becomes failure, not a claimed ordinary exit.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies running an already prepared real project; the result preserves raw stderr beside parsed banners.
   * @evidence contracts/portability.md#os-neutral-implementation Separate executable/argv and cwd preserve native process semantics; PATH uses the native delimiter and the compiler resolver selects its platform package.
   * @evidence contracts/performance.md#efficient-algorithms One native child runs per invocation; stdout/stderr buffering is capped at 32MiB and parsing scans stderr text once.
   * @evidence contracts/performance.md#reuse-equivalent-work The shared cache location serves production content-validated native builds; each process invocation and stderr projection are recomputed.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous primitive waits for its direct child and owns its pipes. This helper retains no child handle and does not establish arbitrary descendant joins; callers own fixture lifetime.
   */
  export function runProject(
    tmpdir: string,
    args: string[] = [],
    env: NodeJS.ProcessEnv = {},
  ): IRunLintResult {
    const result = E2eProcessTrace.spawnSync(
      process.execPath,
      [TTSC_BIN, "--cwd", tmpdir, ...args, "--noEmit"],
      {
        cwd: tmpdir,
        env: {
          ...process.env,
          GOCACHE: TestProject.sharedGoBuildCache(),
          ...env,
          TTSC_CACHE_DIR: SHARED_CACHE_DIR,
          TTSC_TTSX_BINARY: TTSX_BIN,
          TTSC_TSGO_BINARY: TSGO_BINARY,
          PATH: prependGoToPath(),
        },
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 32,
        windowsHide: true,
      },
    );

    const stderr = result.stderr ?? "";
    return {
      status: result.status ?? 1,
      stderr,
      diagnostics: parseDiagnostics(stderr),
    };
  }

  /** Write the minimal tsconfig and source file needed to load @ttsc/lint. */
  function writeFixtureProject(
    tmpdir: string,
    source: string,
    pluginConfig: Record<string, unknown>,
    mainSourcePath: string,
    extraSourcePaths: readonly string[],
  ): void {
    const usesTSX = [mainSourcePath, ...extraSourcePaths].some(
      isIncludedTSXSourcePath,
    );
    const target = path.join(tmpdir, mainSourcePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, "utf8");
    fs.writeFileSync(
      path.join(tmpdir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "commonjs",
            strict: true,
            noEmit: true,
            rootDir: "src",
            ...(usesTSX ? { jsx: "react-jsx" } : {}),
            plugins: [
              {
                transform: "@ttsc/lint",
                ...pluginConfig,
              },
            ],
          },
          include: ["src"],
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  /**
   * Validate a caller-selected main-source path and normalize it to POSIX
   * separators relative to the project root.
   *
   * The synthesized tsconfig pins `rootDir: "src"` and `include: ["src"]`, so a
   * logical filename outside `src/` would silently fall out of the compiled
   * program instead of exercising the rule under test. Escapes and absolute
   * paths are rejected for the same reason fixture roots are validated: the
   * harness must never write outside its disposable project.
   */
  function resolveMainSourcePath(sourcePath: string): string {
    const normalized = resolveProjectSourcePath(sourcePath, "sourcePath");
    assertCanonicalTypeScriptSourceExtension(
      normalized,
      "sourcePath",
      sourcePath,
    );
    if (!normalized.startsWith("src/")) {
      throw new Error(
        `TestLint sourcePath must be a project-root-relative path under src/: ${sourcePath}`,
      );
    }
    return normalized;
  }

  /**
   * Normalize every extra-source target and reject portable aliases before the
   * fixture writes its main source or generated config files.
   */
  function resolveExtraSourcePaths(
    mainSourcePath: string,
    options: {
      extraSources: Record<string, string> | undefined;
      linkedNodeModulePaths: readonly string[];
      writesGeneratedLintConfig: boolean;
    },
  ): [string, string][] {
    const sources = [mainSourcePath];
    const generatedTargets: readonly {
      path: string;
      sourceMayReplaceExactFile: boolean;
    }[] = [
      { path: "tsconfig.json", sourceMayReplaceExactFile: true },
      ...(options.writesGeneratedLintConfig
        ? [{ path: "lint.config.json", sourceMayReplaceExactFile: false }]
        : []),
      {
        path: "node_modules/@ttsc/lint",
        sourceMayReplaceExactFile: false,
      },
      ...options.linkedNodeModulePaths.map((relativePath) => ({
        path: relativePath,
        sourceMayReplaceExactFile: false,
      })),
    ];
    if (options.extraSources === undefined) return [];
    return (Object.entries(options.extraSources) as [string, string][]).map(
      ([sourcePath, content]) => {
        const normalized = resolveProjectSourcePath(
          sourcePath,
          "extraSources path",
        );
        assertCanonicalTypeScriptSourceExtension(
          normalized,
          "extraSources path",
          sourcePath,
        );
        if (
          normalized.toLowerCase().startsWith("src/") &&
          !normalized.startsWith("src/")
        ) {
          throw new Error(
            `TestLint extraSources path must spell the included source root as src/: ${sourcePath}`,
          );
        }
        for (const previous of sources) {
          assertFixtureTargetsDoNotCollide(previous, normalized, sourcePath);
        }
        for (const generated of generatedTargets) {
          const generatedKey = portableFixturePathKey(generated.path);
          const sourceKey = portableFixturePathKey(normalized);
          if (
            isStrictFixturePathAncestor(generatedKey, sourceKey) ||
            isStrictFixturePathAncestor(sourceKey, generatedKey) ||
            (generatedKey === sourceKey &&
              (!generated.sourceMayReplaceExactFile ||
                normalized !== generated.path))
          ) {
            throw new Error(
              `TestLint fixture source path collides with generated target: ${sourcePath} and ${generated.path}`,
            );
          }
        }
        sources.push(normalized);
        return [normalized, content];
      },
    );
  }

  function assertFixtureTargetsDoNotCollide(
    previous: string,
    normalized: string,
    sourcePath: string,
  ): void {
    const previousKey = portableFixturePathKey(previous);
    const sourceKey = portableFixturePathKey(normalized);
    if (
      previousKey === sourceKey ||
      isStrictFixturePathAncestor(previousKey, sourceKey) ||
      isStrictFixturePathAncestor(sourceKey, previousKey)
    ) {
      throw new Error(
        `TestLint fixture source paths collide after portable normalization: ${previous} and ${sourcePath}`,
      );
    }
  }

  function isStrictFixturePathAncestor(parent: string, child: string): boolean {
    return child.startsWith(`${parent}/`);
  }

  /** Normalize a writable fixture target to one project-relative POSIX path. */
  function resolveProjectSourcePath(
    sourcePath: string,
    optionName: string,
  ): string {
    const portable = sourcePath.replaceAll("\\", "/");
    const normalized = path.posix.normalize(portable);
    const hasNonPortableWindowsSegment = portable
      .split("/")
      .some(
        (segment) =>
          segment !== "." &&
          segment !== ".." &&
          (/[<>:"|?*\u0000-\u001f]/.test(segment) ||
            /[. ]$/.test(segment) ||
            /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i.test(
              segment,
            )),
      );
    if (
      sourcePath.trim().length === 0 ||
      sourcePath.includes("\0") ||
      hasNonPortableWindowsSegment ||
      portable.endsWith("/") ||
      path.posix.isAbsolute(portable) ||
      path.win32.parse(sourcePath).root.length !== 0 ||
      normalized === "." ||
      normalized === ".." ||
      normalized.startsWith("../")
    ) {
      throw new Error(
        `TestLint ${optionName} must be a portable non-empty project-root-relative file path: ${sourcePath}`,
      );
    }
    return normalized;
  }

  /** Match Windows path aliases even when the test suite runs on POSIX. */
  function portableFixturePathKey(sourcePath: string): string {
    return sourcePath.toLowerCase();
  }

  /** Whether a generated tsconfig includes this TSX source under `src/`. */
  function isIncludedTSXSourcePath(sourcePath: string): boolean {
    return (
      sourcePath.startsWith("src/") &&
      typescriptSourceExtension(sourcePath) === ".tsx"
    );
  }

  function assertDisposableProjectRoot(projectRoot: string): void {
    const tempRoot = path.resolve(os.tmpdir());
    const resolved = path.resolve(projectRoot);
    const canonicalTempRoot = realpathWithMissingSuffix(tempRoot);
    const tempRoots = new Set([tempRoot, canonicalTempRoot]);
    const canonicalResolved = realpathWithMissingSuffix(resolved);
    let existingRoot: fs.Stats | undefined;
    try {
      existingRoot = fs.lstatSync(resolved);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (
      [...tempRoots].some((candidate) =>
        isStrictChildPath(candidate, resolved),
      ) &&
      isStrictChildPath(canonicalTempRoot, canonicalResolved) &&
      (existingRoot === undefined ||
        (existingRoot.isDirectory() && fs.readdirSync(resolved).length === 0))
    ) {
      return;
    }
    throw new Error(
      `TestLint projectRoot must be an empty disposable directory strictly under ${tempRoot}: ${projectRoot}`,
    );
  }

  function isStrictChildPath(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    return (
      relative !== "" &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  }

  /** Canonicalize through the nearest existing ancestor without creating it. */
  function realpathWithMissingSuffix(location: string): string {
    let existing = location;
    const missing: string[] = [];
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing);
      if (parent === existing) return location;
      missing.unshift(path.basename(existing));
      existing = parent;
    }
    return path.resolve(fs.realpathSync(existing), ...missing);
  }

  function resolveLinkedNodeModules(
    packageNames: readonly string[] | undefined,
  ): { packageName: string; relativePath: string }[] {
    return (packageNames ?? []).map((packageName) => {
      const segments = packageName.split("/");
      const [scopeOrName, scopedName] = segments;
      const isPackageSegment = (segment: string): boolean =>
        segment.length > 0 &&
        !segment.startsWith(".") &&
        !segment.startsWith("_") &&
        /^[a-z0-9._~-]+$/.test(segment);
      const valid =
        packageName.length <= 214 &&
        ((segments.length === 1 && isPackageSegment(scopeOrName ?? "")) ||
          (segments.length === 2 &&
            scopeOrName !== undefined &&
            scopeOrName.startsWith("@") &&
            isPackageSegment(scopeOrName.slice(1)) &&
            isPackageSegment(scopedName ?? "")));
      if (!valid) {
        throw new Error(
          `TestLint linkNodeModules entry must be an npm package name: ${packageName}`,
        );
      }
      let relativePath: string;
      try {
        relativePath = resolveProjectSourcePath(
          path.posix.join("node_modules", ...segments),
          "linkNodeModules entry",
        );
      } catch {
        throw new Error(
          `TestLint linkNodeModules entry must be a portable npm package name: ${packageName}`,
        );
      }
      return {
        packageName,
        relativePath,
      };
    });
  }

  /** Link the workspace @ttsc/lint package as if the fixture had installed it. */
  function seedNodeModulesLink(
    tmpdir: string,
    nativeProducer?: "workspace" | "snapshot",
  ): void {
    const linkParent = path.join(tmpdir, "node_modules", "@ttsc");
    fs.mkdirSync(linkParent, { recursive: true });
    const link = path.join(linkParent, "lint");
    const source =
      nativeProducer === "snapshot"
        ? getNativeLintProducer().packageRoot
        : LINT_PACKAGE_DIR;
    linkNativeLintPackage(source, link);
  }

  /** Link optional runtime dependencies used by ESLint-backed config tests. */
  function linkNodeModulePackage(
    tmpdir: string,
    linkedNodeModule: { packageName: string; relativePath: string },
  ): void {
    const { packageName, relativePath } = linkedNodeModule;
    const packageJson = TestProject.REQUIRE_FROM_TEST.resolve(
      `${packageName}/package.json`,
      {
        paths: [TESTING_PACKAGE_ROOT, TestProject.WORKSPACE_ROOT],
      },
    );
    const source = path.dirname(packageJson);
    const target = path.join(tmpdir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      fs.symlinkSync(source, target, "junction");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
    }
  }

  const ANSI_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g;
  const BANNER_PATTERN =
    /^(.+):(\d+):(\d+)\s+-\s+(error|warning)\s+TS\d+:\s*\[([^\]]+)\]\s*(.*)$/;
  const TYPESCRIPT_SOURCE_EXTENSION_PATTERN =
    /(\.d\.mts|\.d\.cts|\.d\.ts|\.tsx|\.mts|\.cts|\.ts)$/;
  const TYPESCRIPT_SOURCE_EXTENSION_CASE_INSENSITIVE_PATTERN =
    /(\.d\.mts|\.d\.cts|\.d\.ts|\.tsx|\.mts|\.cts|\.ts)$/i;

  /**
   * Return the canonical supported TypeScript suffix for a source path.
   *
   * @evidence contracts/common.md#principled-implementation The anchored suffix pattern recognizes the supported canonical lowercase TypeScript extensions, including declaration suffixes before ordinary suffixes.
   * @evidence contracts/common.md#clear-and-simple-design One classifier is reused by source admission and renderer parsing.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The suffix set is the helper's supported TypeScript contract and does not special-case a fixture or compiler verdict.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies canonical suffix classification and null for unsupported paths.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation classifies path text and makes no native filesystem identity or case-policy claim.
   * @evidence contracts/performance.md#efficient-algorithms One anchored constant-size pattern processes the input string without directory traversal.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current path text is classified per call and no result is cached.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a match result is call-local; no handle or retained state is acquired.
   */
  export function typescriptSourceExtension(sourcePath: string): string | null {
    return sourcePath.match(TYPESCRIPT_SOURCE_EXTENSION_PATTERN)?.[1] ?? null;
  }

  /**
   * Whether a path has one of the TypeScript source extensions we execute.
   *
   * @evidence contracts/common.md#principled-implementation The canonical classifier's non-null result determines whether the path text names a supported suffix.
   * @evidence contracts/common.md#clear-and-simple-design One boolean adapter avoids a second extension policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts It does not claim that the file exists or belongs to a compiler Program.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies supported TypeScript extension recognition.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Text suffix recognition crosses no native filesystem boundary.
   * @evidence contracts/performance.md#efficient-algorithms One delegated constant-pattern classification processes the path text.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every current path string is classified anew.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource or persistent state is owned.
   */
  export function isTypeScriptSourcePath(sourcePath: string): boolean {
    return typescriptSourceExtension(sourcePath) !== null;
  }

  /**
   * Whether a TypeScript-looking suffix differs from the compiler's casing.
   *
   * @evidence contracts/common.md#principled-implementation The canonical-negative and case-insensitive-positive conjunction distinguishes unsupported casing from unrelated non-TypeScript suffixes.
   * @evidence contracts/common.md#clear-and-simple-design One composed predicate keeps rejection policy separate from canonical admission.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Case-insensitive text recognition is used only to reject nonportable authored suffixes, never to infer native path identity.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies TypeScript-looking casing differences.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This pure text predicate does not infer a filesystem's native case policy.
   * @evidence contracts/performance.md#efficient-algorithms At most two fixed-pattern classifications process the supplied path string.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work No completed classification is cached between requests.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate owns no resource or retained state.
   */
  export function hasNonCanonicalTypeScriptSourceExtension(
    sourcePath: string,
  ): boolean {
    return (
      !isTypeScriptSourcePath(sourcePath) &&
      TYPESCRIPT_SOURCE_EXTENSION_CASE_INSENSITIVE_PATTERN.test(sourcePath)
    );
  }

  function assertCanonicalTypeScriptSourceExtension(
    normalized: string,
    optionName: string,
    sourcePath: string,
  ): void {
    if (hasNonCanonicalTypeScriptSourceExtension(normalized)) {
      throw new Error(
        `TestLint ${optionName} must use a canonical lowercase TypeScript source extension: ${sourcePath}`,
      );
    }
  }

  /**
   * Parse the renderer's stderr into structured records.
   *
   * ANSI escape codes are stripped before parsing so colour output from a TTY
   * environment does not confuse the regex.
   *
   * Only complete supported-TypeScript banner lines become records.
   * Continuation lines and other stderr remain outside this projection; the
   * caller retains raw stderr and must assert the native exit status separately.
   *
   * @evidence contracts/common.md#principled-implementation ANSI removal precedes line-banner parsing; only supported TypeScript filenames and complete captured fields become structured diagnostics.
   * @evidence contracts/common.md#clear-and-simple-design One parser projects the renderer's explicit banner format while callers retain full stderr.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unmatched lines are omitted from structured records, not converted into passing compiler results. Parsed findings alone cannot certify execution status.
   * @evidence contracts/common.md#meaningful-documentation The paragraph explains ANSI handling; records represent recognized banner lines only and do not include continuation text.
   * @evidence contracts/portability.md#os-neutral-implementation The greedy filename group retains native Windows drive-colon paths, while line splitting accepts LF and CRLF. Filename matching is textual and does not prove native identity.
   * @evidence contracts/performance.md#efficient-algorithms ANSI normalization and line iteration are linear in output size for these fixed patterns; returned records scale with matched banners.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each current stderr text is parsed anew without retained process or parser results.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only call-local text arrays and records are allocated; returned diagnostics transfer to the caller.
   */
  export function parseDiagnostics(stderr: string): ILintDiagnostic[] {
    const stripped = stderr.replace(ANSI_PATTERN, "");
    const out: ILintDiagnostic[] = [];
    for (const line of stripped.split(/\r?\n/)) {
      const match = line.match(BANNER_PATTERN);
      if (!match) continue;
      const [, file, lineStr, columnStr, category, rule, message] = match;
      if (
        !file ||
        !isTypeScriptSourcePath(file) ||
        !lineStr ||
        !columnStr ||
        !category ||
        !rule ||
        message === undefined
      )
        continue;
      out.push({
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(columnStr, 10),
        severity: category === "warning" ? "warn" : "error",
        rule,
        message: message.trim(),
      });
    }
    return out;
  }

  function sanitizeForFsName(s: string): string {
    return s.replace(/[^\w.-]/g, "_").slice(0, 64);
  }

  /** Prefer a locally provisioned Go toolchain when the shell PATH lacks Go. */
  function prependGoToPath(): string | undefined {
    const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
    return fs.existsSync(localGo)
      ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH;
  }
}
