import { TestLint } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveCorpusSourcePath } from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus source paths preserve TSX and select JSX mode only for
 * TSX.
 *
 * Pins the corpus-to-project boundary that previously wrote every fixture as
 * `src/main.ts`. A TSX fixture must retain its extension and enable JSX
 * parsing. Multi-file projects make the same decision across every source
 * included under `src/`, independent of the caller's path separators, while
 * TS-only and out-of-include files keep the original non-JSX project shape.
 *
 * 1. Resolve default TS and TSX corpus paths and an explicit filename override.
 * 2. Materialize default, TS-only companion, and POSIX/Windows TSX companion
 *    projects.
 * 3. Assert only projects with an included TSX source select React JSX mode.
 */
export const test_lint_corpus_source_paths_preserve_tsx_and_select_jsx_mode =
  (): void => {
    const tsSourcePath = resolveCorpusSourcePath("", "no-console.ts");
    const tsxSourcePath = resolveCorpusSourcePath("", "react/jsx-key.tsx");
    assert.equal(tsSourcePath, "src/main.ts");
    assert.equal(tsxSourcePath, "src/main.tsx");
    for (const [fixture, expected] of [
      ["module.mts", "src/main.mts"],
      ["module.cts", "src/main.cts"],
      ["types.d.ts", "src/main.d.ts"],
      ["types.d.mts", "src/main.d.mts"],
      ["types.d.cts", "src/main.d.cts"],
    ] as const) {
      assert.equal(resolveCorpusSourcePath("", fixture), expected);
    }
    assert.throws(
      () => resolveCorpusSourcePath("", "module.TS"),
      /module\.TS.*canonical lowercase/,
    );
    assert.equal(
      resolveCorpusSourcePath(
        "// @ttsc-corpus-filename: src/components/Named.tsx\n",
        "react/jsx-key.tsx",
      ),
      "src/components/Named.tsx",
    );

    const projects: TestLint.IRunLintProject[] = [];
    try {
      const tsProject = TestLint.createProject({
        name: "corpus-default-ts",
        source: "export const value = 1;\n",
        sourcePath: tsSourcePath,
      });
      projects.push(tsProject);
      const tsxProject = TestLint.createProject({
        name: "corpus-default-tsx",
        source: "export const value = <div />;\n",
        sourcePath: tsxSourcePath,
      });
      projects.push(tsxProject);
      const tsCompanionProject = TestLint.createProject({
        name: "corpus-ts-companion",
        source: "export const value = 1;\n",
        sourcePath: tsSourcePath,
        extraSources: {
          "src/companion.ts": "export const companion = 2;\n",
          "outside.tsx": "export const excluded = <div />;\n",
        },
      });
      projects.push(tsCompanionProject);
      const posixTSXCompanionProject = TestLint.createProject({
        name: "corpus-posix-tsx-companion",
        source: "export const value = 1;\n",
        sourcePath: tsSourcePath,
        extraSources: {
          "src/companion.tsx": "export const companion = <div />;\n",
        },
      });
      projects.push(posixTSXCompanionProject);
      const windowsTSXCompanionProject = TestLint.createProject({
        name: "corpus-windows-tsx-companion",
        source: "export const value = 1;\n",
        sourcePath: tsSourcePath,
        extraSources: {
          "src\\nested\\companion.tsx": "export const companion = <div />;\n",
        },
      });
      projects.push(windowsTSXCompanionProject);

      assert.equal(
        fs.existsSync(path.join(tsProject.tmpdir, "src/main.ts")),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(tsProject.tmpdir, "src/main.tsx")),
        false,
      );
      assert.equal(readCompilerOptions(tsProject.tmpdir).jsx, undefined);

      assert.equal(
        fs.existsSync(path.join(tsxProject.tmpdir, "src/main.tsx")),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(tsxProject.tmpdir, "src/main.ts")),
        false,
      );
      assert.equal(readCompilerOptions(tsxProject.tmpdir).jsx, "react-jsx");

      assert.equal(
        fs.existsSync(path.join(tsCompanionProject.tmpdir, "src/companion.ts")),
        true,
      );
      assert.equal(
        readCompilerOptions(tsCompanionProject.tmpdir).jsx,
        undefined,
      );
      assert.equal(
        readCompilerOptions(posixTSXCompanionProject.tmpdir).jsx,
        "react-jsx",
      );
      assert.equal(
        fs.existsSync(
          path.join(
            windowsTSXCompanionProject.tmpdir,
            "src/nested/companion.tsx",
          ),
        ),
        true,
      );
      assert.equal(
        readCompilerOptions(windowsTSXCompanionProject.tmpdir).jsx,
        "react-jsx",
      );
    } finally {
      for (const project of projects.reverse()) project.cleanup();
    }
  };

function readCompilerOptions(tmpdir: string): Record<string, unknown> {
  const config: unknown = JSON.parse(
    fs.readFileSync(path.join(tmpdir, "tsconfig.json"), "utf8"),
  );
  assert.ok(typeof config === "object" && config !== null);
  const compilerOptions = (config as { compilerOptions?: unknown })
    .compilerOptions;
  assert.ok(typeof compilerOptions === "object" && compilerOptions !== null);
  return compilerOptions as Record<string, unknown>;
}
