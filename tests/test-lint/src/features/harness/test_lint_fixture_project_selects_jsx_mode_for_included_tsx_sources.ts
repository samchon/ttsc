import { TestLint } from "../../../../utils/src/lint/TestLint";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the lint fixture project keeps its source paths and selects JSX mode
 * only when a TSX source is included under `src/`.
 *
 * A TSX main source must keep its extension and enable JSX parsing. A
 * multi-file project makes the same decision across every source included
 * under `src/`, whatever separator the companion path used, while TS-only and
 * out-of-include files keep the non-JSX project shape.
 *
 * 1. Materialize default TS, default TSX, TS-companion, POSIX TSX-companion and
 *    Windows-separator TSX-companion projects.
 * 2. Read back the written files and the generated tsconfig.
 * 3. Assert only projects with an included TSX source select React JSX mode.
 *
 * @evidence contracts/testing.md#behavioral-verification TestLint.createProject writes real projects whose files and generated tsconfig compilerOptions.jsx are read back; React JSX is enabled only when a TSX source falls under the included src subtree.
 * @evidence contracts/testing.md#independent-expectations Literal source paths and authored project sources define the expected files and jsx setting; the test reads the actual generated config rather than checking repository configuration text.
 * @evidence contracts/testing.md#distinguishing-cases A TS main source, a TS companion and a TSX file outside src/ stay non-JSX, while a TSX main source and POSIX or backslash-separated TSX companions enable JSX; the main file is written at its own extension only.
 * @evidence contracts/testing.md#execution-ownership Directly calls the project-materialization helper; all generated projects are cleaned in finally and no TestLint.run, compile or install is invoked.
 */
export function test_lint_fixture_project_selects_jsx_mode_for_included_tsx_sources(): void {
    const projects: TestLint.IRunLintProject[] = [];
    const create = (options: TestLint.IRunLintOptions) => {
      const project = TestLint.createProject(options);
      projects.push(project);
      return project;
    };
    try {
      const tsProject = create({
        name: "fixture-default-ts",
        source: "export const value = 1;\n",
        sourcePath: "src/main.ts",
      });
      const tsxProject = create({
        name: "fixture-default-tsx",
        source: "export const value = <div />;\n",
        sourcePath: "src/main.tsx",
      });
      const tsCompanionProject = create({
        name: "fixture-ts-companion",
        source: "export const value = 1;\n",
        sourcePath: "src/main.ts",
        extraSources: {
          "src/companion.ts": "export const companion = 2;\n",
          "outside.tsx": "export const excluded = <div />;\n",
        },
      });
      const posixTSXCompanionProject = create({
        name: "fixture-posix-tsx-companion",
        source: "export const value = 1;\n",
        sourcePath: "src/main.ts",
        extraSources: {
          "src/companion.tsx": "export const companion = <div />;\n",
        },
      });
      const windowsTSXCompanionProject = create({
        name: "fixture-windows-tsx-companion",
        source: "export const value = 1;\n",
        sourcePath: "src/main.ts",
        extraSources: {
          "src\\nested\\companion.tsx": "export const companion = <div />;\n",
        },
      });

      assert.equal(exists(tsProject, "src/main.ts"), true);
      assert.equal(exists(tsProject, "src/main.tsx"), false);
      assert.equal(readCompilerOptions(tsProject).jsx, undefined);

      assert.equal(exists(tsxProject, "src/main.tsx"), true);
      assert.equal(exists(tsxProject, "src/main.ts"), false);
      assert.equal(readCompilerOptions(tsxProject).jsx, "react-jsx");

      assert.equal(exists(tsCompanionProject, "src/companion.ts"), true);
      assert.equal(exists(tsCompanionProject, "src/src/companion.ts"), false);
      assert.equal(readCompilerOptions(tsCompanionProject).jsx, undefined);

      assert.equal(readCompilerOptions(posixTSXCompanionProject).jsx, "react-jsx");

      assert.equal(
        exists(windowsTSXCompanionProject, "src/nested/companion.tsx"),
        true,
      );
      assert.equal(
        readCompilerOptions(windowsTSXCompanionProject).jsx,
        "react-jsx",
      );
    } finally {
      for (const project of projects.reverse()) project.cleanup();
    }
}

function exists(project: TestLint.IRunLintProject, relative: string): boolean {
  return fs.existsSync(path.join(project.tmpdir, relative));
}

function readCompilerOptions(
  project: TestLint.IRunLintProject,
): Record<string, unknown> {
  const config: unknown = JSON.parse(
    fs.readFileSync(path.join(project.tmpdir, "tsconfig.json"), "utf8"),
  );
  assert.ok(typeof config === "object" && config !== null);
  const compilerOptions = (config as { compilerOptions?: unknown })
    .compilerOptions;
  assert.ok(typeof compilerOptions === "object" && compilerOptions !== null);
  return compilerOptions as Record<string, unknown>;
}
