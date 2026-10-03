import { TestLint, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LintWorkspace } from "../LintWorkspace";

const TSGO_BINARY = TestProject.TSGO_BINARY;
const TTSX_BIN = TestProject.TTSX_BIN;

/**
 * Minimal TypeScript source used by most config-file tests. Contains a `var`
 * declaration (triggers `no-var`) and a `console.log` call (triggers
 * `no-console`), giving each test a choice of which rule to enable.
 */
const SOURCE = fs.readFileSync(path.resolve(import.meta.dirname, "../../../../fixtures/lint/workspace/config-source.ts"), "utf8");

type ILintDiagnostic = TestLint.ILintDiagnostic;
type IRunLintOptions = TestLint.IRunLintOptions;

/** Return the unchanged synchronous lint result; retain operation errors if owned cleanup also fails. */
function runLint(options: IRunLintOptions): TestLint.IRunLintResult {
  const project = createLintProject(options);
  const failures: unknown[] = [];
  try {
    return runLintProject(project.tmpdir);
  } catch (error) {
    failures.push(error);
    throw error;
  } finally {
    try {
      project.cleanup();
    } catch (error) {
      failures.push(error);
      throw new AggregateError(failures, "Lint operation or owned project cleanup failed");
    }
  }
}

/**
 * Materialise a temp project directory from the given lint options without
 * actually running ttsc. Call `project.cleanup()` in a `finally` block.
 */
function createLintProject(options: IRunLintOptions): TestLint.IRunLintProject {
  return TestLint.createProject({
    ...options,
    nativeProducer: options.nativeProducer ?? LintWorkspace.nativeProducer(),
    projectRoot: options.projectRoot ?? LintWorkspace.caseRoot(options.name),
  });
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
  env: NodeJS.ProcessEnv = {},
): TestLint.IRunLintResult {
  return TestLint.runProject(tmpdir, args, env);
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
  createLintProject,
  lintGoPath,
  runLint,
  runLintProject,
  SOURCE,
  TSGO_BINARY,
  TTSX_BIN,
};
export type { ILintDiagnostic, IRunLintOptions };
