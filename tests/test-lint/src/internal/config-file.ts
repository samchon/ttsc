import { TestLint, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
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
