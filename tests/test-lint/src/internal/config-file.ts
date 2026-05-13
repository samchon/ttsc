import { TestLint, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

const TSGO_BINARY = TestProject.TSGO_BINARY;
const TTSX_BIN = TestProject.TTSX_BIN;

const SOURCE = `var value = 1;\nconsole.log(value);\n`;
const SOURCE_WITH_TS_ESLINT_VIOLATIONS = `var value = 1;\nlet typed: any = value;\nconsole.log(typed);\n`;

type ILintDiagnostic = TestLint.ILintDiagnostic;
type IRunLintOptions = TestLint.IRunLintOptions;

function runLint(options: IRunLintOptions): TestLint.IRunLintResult {
  return TestLint.run(options);
}

function createLintProject(options: IRunLintOptions): TestLint.IRunLintProject {
  return TestLint.createProject(options);
}

function runLintProject(
  tmpdir: string,
  args: string[] = [],
): TestLint.IRunLintResult {
  return TestLint.runProject(tmpdir, args);
}

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
