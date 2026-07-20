import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const cases = [
  {
    name: "--noEmit",
    argv: (root: string) => ["--cwd", root, "--noEmit", "src/main.ts"],
  },
  {
    name: "check",
    argv: (root: string) => ["check", "--cwd", root, "src/main.ts"],
  },
  {
    name: "--emit=false",
    argv: (root: string) => [
      "--cwd",
      root,
      "--emit=false",
      "src/main.ts",
    ],
  },
  {
    name: "--noEmit=true",
    argv: (root: string) => [
      "--cwd",
      root,
      "--noEmit=true",
      "src/main.ts",
    ],
  },
] as const;

/**
 * Verifies compiler corpus: single-file no-emit forms leave the tree unchanged.
 *
 * `runSingleFileEmit` needs a private temporary emit to return transformed text,
 * but none of the analysis-only forms may turn that text into a user-visible
 * output. The four forms cover the command alias and both boolean spellings at
 * the launcher boundary.
 *
 * 1. Materialize an otherwise-emitting CommonJS project for each no-emit form.
 * 2. Run that form with one TypeScript input file.
 * 3. Assert the expected JavaScript file and emitted-file stdout line are absent.
 */
export const test_compiler_corpus_single_file_noemit_forms_leave_tree_unchanged =
  (): void => {
    for (const current of cases) {
      const root = commonJsProject({
        "src/main.ts": `export const value: number = 1;\n`,
      });
      const result = spawn(ttscBin, current.argv(root), { cwd: root });
      const output = path.join(root, "dist", "main.js");
      assert.equal(result.status, 0, `${current.name}: ${result.stderr}`);
      assert.equal(
        fs.existsSync(output),
        false,
        `${current.name} must not write ${output}`,
      );
      assert.equal(
        result.stdout.includes("dist"),
        false,
        `${current.name} must not print an emitted file path: ${result.stdout}`,
      );
    }
  };
