import { TestLint, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const TSGO_BINARY = TestProject.TSGO_BINARY;
const TTSX_BIN = TestProject.TTSX_BIN;

/**
 * Minimal TypeScript source used by most config-file tests. Contains a `var`
 * declaration (triggers `no-var`) and a `console.log` call (triggers
 * `no-console`), giving each test a choice of which rule to enable.
 */
const SOURCE = `var value = 1;\nconsole.log(value);\n`;

/**
 * Source that additionally contains a typed `any` variable. Used by tests that
 * exercise `typescript-eslint` typed rules such as `no-explicit-any`.
 */
const SOURCE_WITH_TS_ESLINT_VIOLATIONS = `var value = 1;\nlet typed: any = value;\nconsole.log(typed);\n`;

type ILintDiagnostic = TestLint.ILintDiagnostic;
type IRunLintOptions = TestLint.IRunLintOptions;

/** Run a one-shot lint operation and return the result synchronously. */
function runLint(options: IRunLintOptions): TestLint.IRunLintResult {
  return TestLint.run(options);
}

/**
 * Materialise a temp project directory from the given lint options without
 * actually running ttsc. Call `project.cleanup()` in a `finally` block.
 */
function createLintProject(options: IRunLintOptions): TestLint.IRunLintProject {
  return TestLint.createProject(options);
}

/**
 * Run ttsc in an already-materialised temp project directory and return the
 * result synchronously.
 *
 * @param tmpdir - The temp directory created by `createLintProject`.
 * @param args - Extra CLI arguments appended to the ttsc invocation.
 */
function runLintProject(
  tmpdir: string,
  args: string[] = [],
): TestLint.IRunLintResult {
  return TestLint.runProject(tmpdir, args);
}

/**
 * Build an `extraSources` map that installs a minimal fake `eslint` package
 * into `node_modules/eslint/`. The fake `ESLint` class reports a single
 * diagnostic with the given rule ID and message for every linted file.
 *
 * Used by tests that need an ESLint runtime stub without installing the real
 * package, so the fixture stays fast and hermetic.
 *
 * @param ruleId - The `ruleId` field placed on every reported message.
 * @param message - The `message` field placed on every reported message.
 */
function fakeEslintRuntimeModule(
  ruleId: string,
  message: string,
): Record<string, string> {
  return {
    "node_modules/eslint/package.json": JSON.stringify({
      type: "commonjs",
      main: "./index.cjs",
    }),
    "node_modules/eslint/index.cjs": `const path = require("node:path");

    class ESLint {
      constructor(options) {
        this.options = options;
      }
      async lintFiles(files) {
        return files.map((filePath) => ({
          filePath: path.resolve(filePath),
          messages: [
            {
              ruleId: ${JSON.stringify(ruleId)},
              severity: 2,
              message: ${JSON.stringify(message)},
              line: 1,
              column: 7,
              endLine: 1,
              endColumn: 14,
            },
          ],
        }));
      }
    }

    module.exports = {
      ESLint,
      loadESLint: async () => ESLint,
    };\n`,
  };
}

/**
 * Run ESLint directly against the given files using the project's own ESLint
 * installation. Returns the same `ILintDiagnostic` shape that ttsc outputs, so
 * callers can compare the two arrays with `assert.deepEqual`.
 *
 * @param tmpdir - Root of the temp project (determines the require base).
 * @param configPath - Path to the flat config file, relative to `tmpdir`.
 * @param files - Source file paths, relative to `tmpdir`, to lint.
 */
async function runESLintDirect(
  tmpdir: string,
  configPath: string,
  files: string[],
): Promise<ILintDiagnostic[]> {
  const requireFromProject = createRequire(path.join(tmpdir, "package.json"));
  const eslintModule = requireFromProject("eslint") as any;
  const ESLintCtor =
    typeof eslintModule.loadESLint === "function"
      ? await eslintModule.loadESLint({ useFlatConfig: true })
      : (eslintModule.ESLint ??
        eslintModule.default?.ESLint ??
        eslintModule.default);
  const eslint = new ESLintCtor({
    cwd: tmpdir,
    overrideConfigFile: path.join(tmpdir, configPath),
    ignore: true,
    warnIgnored: false,
  });
  const results = await eslint.lintFiles(
    files.map((file) => path.join(tmpdir, file)),
  );
  return results.flatMap((result: any) =>
    result.messages.map((message: any) => ({
      file: path.relative(tmpdir, result.filePath).replaceAll(path.sep, "/"),
      line: message.line || 1,
      column: message.column || 1,
      severity: message.severity >= 2 ? "error" : "warn",
      rule: message.ruleId || "eslint",
      message: message.message,
    })),
  );
}

/**
 * Strip any extra fields from a diagnostic so the object only contains the six
 * canonical properties used in parity comparisons.
 */
function diagnosticComparable(diagnostic: ILintDiagnostic): ILintDiagnostic {
  return {
    file: diagnostic.file,
    line: diagnostic.line,
    column: diagnostic.column,
    severity: diagnostic.severity,
    rule: diagnostic.rule,
    message: diagnostic.message,
  };
}

/**
 * Assert that ttsc and the real ESLint API report exactly the same diagnostics
 * for the given project options.
 *
 * Materialises a temp project, runs both ttsc and ESLint against it, then
 * deep-equals the normalised diagnostic arrays. The project is cleaned up in a
 * `finally` block regardless of outcome.
 *
 * @param options - Lint project options (source, config, extra sources, …).
 * @param files - Source files to pass to ESLint, relative to the project root.
 *   Defaults to `["src/main.ts"]`.
 */
async function assertESLintRuntimeParity(
  options: IRunLintOptions,
  files: string[] = ["src/main.ts"],
): Promise<void> {
  const project = createLintProject(options);
  try {
    const ttsc = runLintProject(project.tmpdir);
    const eslint = await runESLintDirect(
      project.tmpdir,
      "eslint.config.mjs",
      files,
    );

    assert.notEqual(ttsc.status, 0, ttsc.stderr);
    assert.deepEqual(
      ttsc.diagnostics.map(diagnosticComparable),
      eslint,
      ttsc.stderr,
    );
  } finally {
    project.cleanup();
  }
}

/**
 * Return a `PATH` value that prepends the local Go SDK bin directory
 * (`~/go-sdk/go/bin`) when it exists. Used to ensure the Go toolchain is
 * reachable in CI and local dev environments that install Go outside the system
 * `PATH`.
 */
function lintGoPath(): string | undefined {
  const localGo = path.join(os.homedir(), "go-sdk", "go", "bin");
  return fs.existsSync(localGo)
    ? `${localGo}${path.delimiter}${process.env.PATH ?? ""}`
    : process.env.PATH;
}

export {
  assert,
  assertESLintRuntimeParity,
  createLintProject,
  diagnosticComparable,
  fakeEslintRuntimeModule,
  lintGoPath,
  runESLintDirect,
  runLint,
  runLintProject,
  SOURCE,
  SOURCE_WITH_TS_ESLINT_VIOLATIONS,
  TSGO_BINARY,
  TTSX_BIN,
};
export type { ILintDiagnostic, IRunLintOptions };
