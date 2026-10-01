import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

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
    argv: (root: string) => ["--cwd", root, "--emit=false", "src/main.ts"],
  },
  {
    name: "--noEmit=true",
    argv: (root: string) => ["--cwd", root, "--noEmit=true", "src/main.ts"],
  },
] as const;

/**
 * Verifies compiler corpus: single-file no-emit forms leave the tree unchanged.
 *
 * `runSingleFileEmit` needs a private temporary emit to return transformed
 * text, but none of the analysis-only forms may turn that text into a
 * user-visible output. The four forms cover the command alias and both boolean
 * spellings at the launcher boundary.
 *
 * 1. Materialize an otherwise-emitting CommonJS project for each no-emit form.
 * 2. Run that form with one TypeScript input file.
 * 3. Assert the expected JavaScript file and emitted-file stdout line are absent.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs four positional analysis-only forms: noEmit, check, emit=false and noEmit=true; each must exit zero without dist/main.js or emitted dist-path stdout.
 * @evidence contracts/testing.md#independent-expectations All four documented spellings suppress final user-tree output despite private compiler work. Literal absence and quiet stdout follow that command contract independently of flag parsing.
 * @evidence contracts/testing.md#distinguishing-cases Owns the command alias and three boolean/flag spellings against normally emitting valid sources. Invalid-input diagnostics and watch transitions have their own entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_single_file_noemit_forms_leave_tree_unchanged is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary Each public command spelling must pass launcher routing and native compatibility work without exposing emitted output; direct boolean units cannot prove dispatch/write integration.
 * @evidence contracts/e2e.md#shared-execution Four separate roots/commands distinguish command spellings without stale outputs; built compiler/package preparation is shared and no plugin build repeats. The loop stops later forms on an assertion failure, an existing execution limitation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each current.name labels failures and each root is unique. Commands finish synchronously and TestProject owns every root until exit; no fixture or warm output can determine another form result.
 * @evidence contracts/e2e.md#preserved-coverage All four status/output/stdout triplets remain in the local cases loop under this named export. The case checks the expected output path rather than a complete directory-tree diff.
 */
export const test_compiler_corpus_single_file_noemit_forms_leave_tree_unchanged =
  (): void => {
    for (const current of cases) {
      const root = commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_single_file_noemit_forms_leave_tree_unchanged/inputs-1"));
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
