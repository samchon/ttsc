import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

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
const SHARED_CACHE_DIR = TestProject.tmpdir("ttsc-lint-e2e-cache-");

export namespace TestLint {
  /** Normalized severities produced by the native lint plugin. */
  export type LintSeverity = "warn" | "error";
  /** User-facing rule config severities accepted in test tsconfig snippets. */
  export type LintRuleConfigSeverity = "off" | "warning" | LintSeverity;
  /**
   * One `rules` map entry: a bare severity or the `[severity, options]` tuple
   * the lint config format accepts for option-bearing rules.
   */
  export type LintRuleConfigEntry =
    | LintRuleConfigSeverity
    | readonly [LintRuleConfigSeverity, unknown];

  /** Parsed representation of one rendered lint diagnostic. */
  export interface ILintDiagnostic {
    file: string;
    line: number;
    column: number;
    severity: LintSeverity;
    rule: string;
    message: string;
  }

  /** Expected diagnostic encoded in a fixture expectation comment. */
  export interface ILintExpectation {
    rule: string;
    severity: LintSeverity;
    line: number;
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
   */
  export interface IRunLintOptions {
    name: string;
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
    rules?: Record<string, LintRuleConfigEntry>;
    pluginConfig?: Record<string, unknown>;
    extraSources?: Record<string, string>;
    linkNodeModules?: string[];
  }

  /**
   * Temporary project handle returned when a test needs manual lifecycle
   * control.
   */
  export interface IRunLintProject {
    tmpdir: string;
    cleanup(): void;
  }

  /** Raw process result plus diagnostics parsed from stderr. */
  export interface IRunLintResult {
    status: number;
    stderr: string;
    diagnostics: ILintDiagnostic[];
  }

  /** Create, run, and remove a one-off lint fixture project. */
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
      seedNodeModulesLink(tmpdir);
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

  /** Run ttsc in lint mode against an already materialized fixture project. */
  export function runProject(
    tmpdir: string,
    args: string[] = [],
    env: NodeJS.ProcessEnv = {},
  ): IRunLintResult {
    const result = spawnSync(
      process.execPath,
      [TTSC_BIN, "--cwd", tmpdir, ...args, "--noEmit"],
      {
        cwd: tmpdir,
        env: {
          ...process.env,
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
  function seedNodeModulesLink(tmpdir: string): void {
    const linkParent = path.join(tmpdir, "node_modules", "@ttsc");
    fs.mkdirSync(linkParent, { recursive: true });
    const link = path.join(linkParent, "lint");
    try {
      fs.symlinkSync(LINT_PACKAGE_DIR, link, "junction");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
    }
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

  /** Return the canonical supported TypeScript suffix for a source path. */
  export function typescriptSourceExtension(sourcePath: string): string | null {
    return sourcePath.match(TYPESCRIPT_SOURCE_EXTENSION_PATTERN)?.[1] ?? null;
  }

  /** Whether a path has one of the TypeScript source extensions we execute. */
  export function isTypeScriptSourcePath(sourcePath: string): boolean {
    return typescriptSourceExtension(sourcePath) !== null;
  }

  /** Whether a TypeScript-looking suffix differs from the compiler's casing. */
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

  /**
   * Read standalone line or JSX-block expectation comments and return the
   * target line each one anchors to. Mirrors the ttsc plugin corpus expectation
   * format.
   *
   * Blank lines and stacked expectation annotations between the marker and its
   * target are skipped. A `@ts-expect-error` / `@ts-ignore` suppressor is also
   * skipped unless the rule being tested is `ban-ts-comment` itself. Malformed
   * markers and markers without a following target fail immediately.
   */
  export function parseExpectations(source: string): ILintExpectation[] {
    const lines = source.split(/\r?\n/);
    const expected: ILintExpectation[] = [];
    for (let i = 0; i < lines.length; i++) {
      const marker = parseExpectationMarker(lines[i] ?? "", i + 1);
      if (marker === null) continue;
      const { rule, severity } = marker;
      // Skip blank lines and other expectation annotations stacked
      // above the same target, but NOT regular comment lines — rules
      // like typescript/ban-ts-comment / typescript/triple-slash-reference
      // fire on a comment itself, and the convention is to put the
      // annotation right above the line it pins.
      let target = i + 1;
      while (
        target < lines.length &&
        (/^\s*$/.test(lines[target] ?? "") ||
          parseExpectationMarker(lines[target] ?? "", target + 1) !== null ||
          (rule !== "typescript/ban-ts-comment" &&
            /^\s*\/\/\s*@ts-(?:expect-error|ignore)\b/.test(
              lines[target] ?? "",
            )))
      ) {
        target++;
      }
      if (target >= lines.length) {
        throw new Error(
          `lint expectation at line ${i + 1} has no following target`,
        );
      }
      expected.push({ rule, severity, line: target + 1 });
    }
    return expected;
  }

  function parseExpectationMarker(
    line: string,
    lineNumber: number,
  ): { rule: string; severity: LintSeverity } | null {
    const isLineMarker = /^\s*\/\/\s*expect\b/.test(line);
    const isJsxMarker = /^\s*\{\s*\/\*\s*expect\b/.test(line);
    if (!isLineMarker && !isJsxMarker) return null;

    const match = isLineMarker
      ? line.match(/^\s*\/\/\s*expect:\s*([\w][\w/-]*)\s+(error|warn)\s*$/)
      : line.match(
          /^\s*\{\s*\/\*\s*expect:\s*([\w][\w/-]*)\s+(error|warn)\s*\*\/\s*\}\s*$/,
        );
    if (!match?.[1] || !match[2]) {
      throw new Error(
        `malformed lint expectation at line ${lineNumber}; expected ` +
          "`// expect: <rule> <error|warn>` or " +
          "`{ /* expect: <rule> <error|warn> */ }`",
      );
    }
    return {
      rule: match[1],
      severity: match[2] as LintSeverity,
    };
  }

  /**
   * Build a `rules` map for tsconfig from the expectations parsed out of a
   * fixture file. Every rule that appears in an expectation annotation is
   * enabled at its annotated severity; everything else is implicitly off (the
   * default for unconfigured rules).
   */
  export function rulesFromExpectations(
    expected: ILintExpectation[],
  ): Record<string, LintSeverity> {
    const out: Record<string, LintSeverity> = {};
    for (const exp of expected) {
      out[exp.rule] = exp.severity;
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
