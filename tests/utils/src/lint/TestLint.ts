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

const LINT_SOURCE_DIR = path.join(TestProject.TEST_PACKAGE_ROOT, "src", "lint");
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
// far too slow. Instead we resolve the tsgo binary from the workspace
// once and forward it to every spawned ttsc via env vars (matches the
// shared testing project helper's strategy).
const TSGO_BINARY = (function resolveTsgoBinary() {
  const packageJson = TestProject.REQUIRE_FROM_TEST.resolve(
    "@typescript/native-preview/package.json",
    { paths: [TestProject.WORKSPACE_ROOT] },
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
})();

// Plugin builds (Go) take ~1-2s the first time; share the cache dir
// across the whole test run so subsequent cases reuse the binary.
const SHARED_CACHE_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "ttsc-lint-e2e-cache-"),
);
process.on("exit", () => {
  try {
    fs.rmSync(SHARED_CACHE_DIR, { recursive: true, force: true });
  } catch {}
});

export namespace TestLint {
  /** Normalized severities produced by the native lint plugin. */
  export type LintSeverity = "warn" | "error";
  /** User-facing rule config severities accepted in test tsconfig snippets. */
  export type LintRuleConfigSeverity = "off" | "warning" | LintSeverity;

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

  /** Inputs needed to synthesize and execute one lint fixture project. */
  export interface IRunLintOptions {
    name: string;
    source: string;
    rules?: Record<string, LintRuleConfigSeverity>;
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
    const { name, source, rules, pluginConfig, extraSources, linkNodeModules } =
      options;
    const tmpdir = fs.mkdtempSync(
      path.join(os.tmpdir(), `ttsc-lint-case-${sanitizeForFsName(name)}-`),
    );
    try {
      writeFixtureProject(
        tmpdir,
        source,
        pluginConfig ?? { rules: rules ?? {} },
      );
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
  ): IRunLintResult {
    const result = spawnSync(
      process.execPath,
      [TTSC_BIN, "--cwd", tmpdir, ...args, "--noEmit"],
      {
        cwd: tmpdir,
        env: {
          ...process.env,
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
  ): void {
    fs.mkdirSync(path.join(tmpdir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpdir, "src", "main.ts"), source, "utf8");
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
   * @param {string} stderr
   * @returns {{
   *   file: string;
   *   line: number;
   *   column: number;
   *   severity: "warn" | "error";
   *   rule: string;
   *   message: string;
   * }[]}
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
   * @param {string} source
   * @returns {{ rule: string; severity: "warn" | "error"; line: number }[]}
   */
  export function parseExpectations(source: string): ILintExpectation[] {
    const lines = source.split(/\r?\n/);
    const expected: ILintExpectation[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const match = line.match(/\/\/\s*expect:\s*([\w-]+)\s+(error|warn)\s*$/);
      if (!match) continue;
      const rule = match[1];
      const severity = match[2] as LintSeverity | undefined;
      if (!rule || !severity) continue;
      // Skip blank lines and other `// expect:` annotations stacked
      // above the same target, but NOT regular comment lines — rules
      // like ban-ts-comment / triple-slash-reference fire on a comment
      // itself, and the convention is to put the annotation right above
      // the line it pins.
      let target = i + 1;
      while (
        target < lines.length &&
        (/^\s*$/.test(lines[target] ?? "") ||
          /^\s*\/\/\s*expect:/.test(lines[target] ?? "") ||
          (rule !== "ban-ts-comment" &&
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
