import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { TestProject } from "../TestProject";

// Spawn the real `ttsc` binary against an isolated TypeScript fixture
// and parse the rendered stderr diagnostics into structured records.
//
// Each rule's e2e test passes one `.ts` file (the violation case) and a
// rules-map. The helper:
//   1. mkdtemp's a fixture project with the supplied source as
//      `src/main.ts` and a synthesized `tsconfig.json`.
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

  /** Expected diagnostic encoded in a fixture with `// expect:` comments. */
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
    /** Optional disposable root under the OS temp dir; cleanup removes it. */
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
    const tmpdir =
      projectRoot ??
      TestProject.tmpdir(`ttsc-lint-case-${sanitizeForFsName(name)}-`);
    if (projectRoot !== undefined) {
      assertDisposableProjectRoot(projectRoot);
    }
    try {
      // The tsconfig plugin entry never carries rules: it is empty, or
      // optionally names a config file via `configFile`. When a test uses the
      // `rules` shorthand, materialize a discoverable `lint.config.json`.
      writeFixtureProject(tmpdir, source, pluginConfig ?? {}, sourcePath);
      if (extraSources) {
        for (const [relPath, content] of Object.entries(extraSources) as [
          string,
          string,
        ][]) {
          const target = path.join(tmpdir, relPath);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, content, "utf8");
        }
      }
      if (rules !== undefined) {
        fs.writeFileSync(
          path.join(tmpdir, "lint.config.json"),
          JSON.stringify({ rules }, null, 2),
          "utf8",
        );
      }
      seedNodeModulesLink(tmpdir);
      if (linkNodeModules) {
        for (const packageName of linkNodeModules) {
          linkNodeModulePackage(tmpdir, packageName);
        }
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
    sourcePath: string = path.posix.join("src", "main.ts"),
  ): void {
    const target = path.join(tmpdir, resolveMainSourcePath(sourcePath));
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
   * The synthesized tsconfig pins `rootDir: "src"` and `include: ["src"]`, so
   * a logical filename outside `src/` would silently fall out of the compiled
   * program instead of exercising the rule under test. Escapes and absolute
   * paths are rejected for the same reason fixture roots are validated: the
   * harness must never write outside its disposable project.
   */
  function resolveMainSourcePath(sourcePath: string): string {
    const normalized = path.posix.normalize(sourcePath.replaceAll("\\", "/"));
    if (
      path.isAbsolute(normalized) ||
      !normalized.startsWith("src/") ||
      normalized
        .split("/")
        .some((segment) => segment === ".." || segment === "")
    ) {
      throw new Error(
        `TestLint sourcePath must be a project-root-relative path under src/: ${sourcePath}`,
      );
    }
    return normalized;
  }

  function assertDisposableProjectRoot(projectRoot: string): void {
    const tempRoot = path.resolve(os.tmpdir());
    const resolved = path.resolve(projectRoot);
    const tempRoots = new Set([tempRoot, realpathIfPossible(tempRoot)]);
    if (
      [...tempRoots].some(
        (candidate) =>
          isSameOrChildPath(candidate, resolved) ||
          isSameOrChildPath(candidate, realpathIfPossible(resolved)),
      )
    ) {
      return;
    }
    throw new Error(
      `TestLint projectRoot must be a disposable directory under ${tempRoot}: ${projectRoot}`,
    );
  }

  function isSameOrChildPath(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    if (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    ) {
      return true;
    }
    return false;
  }

  function realpathIfPossible(location: string): string {
    try {
      return fs.realpathSync(location);
    } catch {
      return location;
    }
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
  function linkNodeModulePackage(tmpdir: string, packageName: string): void {
    const packageJson = TestProject.REQUIRE_FROM_TEST.resolve(
      `${packageName}/package.json`,
      {
        paths: [TESTING_PACKAGE_ROOT, TestProject.WORKSPACE_ROOT],
      },
    );
    const source = path.dirname(packageJson);
    const target = path.join(tmpdir, "node_modules", ...packageName.split("/"));
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
    /(?:^|[\s/])([^\s:]+\.ts):(\d+):(\d+)\s+-\s+(error|warning)\s+TS\d+:\s*\[([^\]]+)\]\s*(.*)$/;

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
   * Read `// expect: <rule> <severity>` comments and return the line each one
   * anchors to (the next non-comment, non-blank line after the annotation).
   * Mirrors the ttsc plugin corpus expectation format.
   *
   * Blank lines and stacked `// expect:` annotations between the marker and its
   * target are skipped. A `@ts-expect-error` / `@ts-ignore` suppressor is also
   * skipped unless the rule being tested is `ban-ts-comment` itself.
   */
  export function parseExpectations(source: string): ILintExpectation[] {
    const lines = source.split(/\r?\n/);
    const expected: ILintExpectation[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const match = line.match(
        /\/\/\s*expect:\s*([\w][\w/-]*)\s+(error|warn)\s*$/,
      );
      if (!match) continue;
      const rule = match[1];
      const severity = match[2] as LintSeverity | undefined;
      if (!rule || !severity) continue;
      // Skip blank lines and other `// expect:` annotations stacked
      // above the same target, but NOT regular comment lines — rules
      // like typescript/ban-ts-comment / typescript/triple-slash-reference
      // fire on a comment itself, and the convention is to put the
      // annotation right above the line it pins.
      let target = i + 1;
      while (
        target < lines.length &&
        (/^\s*$/.test(lines[target] ?? "") ||
          /^\s*\/\/\s*expect:/.test(lines[target] ?? "") ||
          (rule !== "typescript/ban-ts-comment" &&
            /^\s*\/\/\s*@ts-(?:expect-error|ignore)\b/.test(
              lines[target] ?? "",
            )))
      ) {
        target++;
      }
      if (target < lines.length) {
        expected.push({ rule, severity, line: target + 1 });
      }
    }
    return expected;
  }

  /**
   * Build a `rules` map for tsconfig from the expectations parsed out of a
   * fixture file. Every rule that appears in `// expect:` annotations is
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
