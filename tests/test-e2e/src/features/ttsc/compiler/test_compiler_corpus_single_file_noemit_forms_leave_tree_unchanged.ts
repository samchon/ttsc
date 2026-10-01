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
] as const;

/**
 * Verifies compiler corpus: single-file no-emit forms leave the tree unchanged.
 *
 * `runSingleFileEmit` needs a private temporary emit to return transformed
 * text, but none of the analysis-only forms may turn that text into a
 * user-visible output. The canonical flag and public command alias retain their
 * real launcher routes; equivalent boolean spellings execute in source units.
 *
 * 1. Materialize one otherwise-emitting CommonJS baseline.
 * 2. Run the canonical no-emit flag and the check alias with its input file.
 * 3. Collect each command's status, output-absence and stdout assertions independently.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs noEmit and the public check alias with a positional source; each must exit zero without dist/main.js or emitted dist-path stdout. Per-command failures are collected so one failed spelling does not block the other.
 * @evidence contracts/testing.md#independent-expectations Analysis-only single-file commands suppress final user-tree output despite private compiler work. Literal absence and quiet stdout follow that command contract independently of flag parsing.
 * @evidence contracts/testing.md#distinguishing-cases Owns canonical flag versus command-alias dispatch against the same normally emitting source. test_build_mode_options_preserve_rejections_and_emit_precedence verifies emit=false and noEmit=true have the same actual launcher option state as the canonical flag; invalid-input diagnostics and watch transitions have other entries.
 * @evidence contracts/testing.md#execution-ownership The named export under src/features/ttsc/compiler is discovered by TestExecutor in the single test-e2e package. Its two scenario labels own actual built-launcher invocations; source option equivalence executes separately in test-ttsc.
 * @evidence contracts/e2e.md#necessary-boundary Canonical flag and command-alias routing must connect private native emission to final write suppression and stdout. Source option units cannot prove that compiler/writer connection, so both actual command routes remain.
 * @evidence contracts/e2e.md#shared-execution Two command routes share one immutable CommonJS baseline and already built compiler artifacts. The removed boolean spellings produce identical downstream options in the direct source unit, eliminating two redundant compiler requests and three project materializations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both sequential commands use the same unchanged sources and config. Before each command only the expected output file is removed, restoring the absence premise if an earlier failed case incorrectly wrote it. Every command's synchronous lifetime ends before assertions; a failed command does not hide the second case, and TestProject owns the baseline lifetime. No cache invalidation or cold producer behavior is claimed.
 * @evidence contracts/e2e.md#preserved-coverage The canonical flag and alias retain status/output/stdout triplets. emit=false and noEmit=true transfer their lexical distinctions to test_build_mode_options_preserve_rejections_and_emit_precedence, whose actual parser and mode adapter require literal false emit, src/main.ts membership, empty passthrough and disabled watch/fix/format before the common downstream connection exercised here. The output check still concerns the expected path rather than a complete tree diff.
 */
export const test_compiler_corpus_single_file_noemit_forms_leave_tree_unchanged =
  (): void => {
    const root = commonJsProject(FixtureFiles.read("ttsc/compiler_corpus_single_file_noemit_forms_leave_tree_unchanged/inputs-1"));
    const failures: unknown[] = [];
    for (const current of cases) {
      try {
        const output = path.join(root, "dist", "main.js");
        fs.rmSync(output, { force: true });
        const result = spawn(ttscBin, current.argv(root), { cwd: root });
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
      } catch (error) {
        failures.push(new Error(current.name, { cause: error }));
      }
    }
    if (failures.length) throw new AggregateError(failures, "single-file no-emit boundaries failed");
  };
