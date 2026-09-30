import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  os,
  parseDiagnostics,
  parseExpectations,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint surfaces rule violations through the
 * normal failure path.
 *
 * This is the primary correctness test for the lint diagnostic pipeline. The
 * `lint-violations` fixture carries inline `// expect:` annotations marking
 * expected rule/severity pairs. The test parses both the annotations and the
 * actual stderr diagnostics to verify a bijective match — no missing and no
 * unexpected violations — and confirms that a rule set to `off` never fires.
 *
 * 1. Copy the `lint-violations` fixture (which contains `// expect:` comments).
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert non-zero exit, that every annotated violation appears in stderr, that
 *    no unannotated violation appears, and that `[no-non-null-assertion]` (the
 *    `off` rule) is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --noEmit returns failure and matches every parsed fixture rule/severity/line expectation in both directions while the off rule stays absent.
 * @evidence contracts/testing.md#independent-expectations Authored expect comments and lint config establish the rule, severity and source line before diagnostics run; the expected set is not derived from stderr.
 * @evidence contracts/testing.md#distinguishing-cases Enabled errors/warnings and an off no-non-null-assertion rule share one consumer check; membership comparisons do not independently count duplicate identical diagnostics.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path entry is discovered by TestExecutor from corpus-ttsc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary One consumer CLI invocation activates the real lint descriptor/native host and carries rule, severity and source line into rendered diagnostics. Annotated membership and the disabled-rule absence verify the complete diagnostic transport, while portable individual rule semantics belong to their existing Go unit tests.
 * @evidence contracts/e2e.md#shared-execution One copied lint consumer and one --noEmit invocation carry the entire annotated diagnostic corpus; the shared producer cache reuses the same lint binary for other corpus consumers. Rule severities are options of that producer and do not require a build per rule.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --noEmit returns failure and matches every parsed fixture rule/severity/line expectation in both directions while the off rule stays absent. These assertions stay in test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path =
  () => {
    const root = setupLintProject("lint-violations");
    const cacheDir = SHARED_PLUGIN_CACHE_DIR;
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.notEqual(result.status, 0, "expected lint errors to fail the build");

    // Build the expected diagnostic set from `// expect:` annotations in
    // the fixture. Every annotation pins (rule, severity) at the next
    // non-comment, non-blank line — the renderer's `path:line:col` banner
    // must match the line we annotated.
    const sourcePath = path.join(root, "src", "main.ts");
    const expected = parseExpectations(sourcePath);
    const got = parseDiagnostics(result.stderr, sourcePath);

    // 1. No diagnostic is missing.
    for (const exp of expected) {
      const hit = got.find(
        (g) =>
          g.line === exp.line &&
          g.rule === exp.rule &&
          g.severity === exp.severity,
      );
      assert.ok(
        hit,
        `expected ${exp.severity} [${exp.rule}] at line ${exp.line}; stderr=\n${result.stderr}`,
      );
    }

    // 2. No diagnostic is unexpected.
    for (const g of got) {
      const hit = expected.find(
        (exp) =>
          exp.line === g.line &&
          exp.rule === g.rule &&
          exp.severity === g.severity,
      );
      assert.ok(
        hit,
        `unexpected ${g.severity} [${g.rule}] at line ${g.line}; not annotated in fixture\n${result.stderr}`,
      );
    }

    // 3. The "off" rule never fires (sanity — `probe(x: number | null)`
    // returns `x!`, which would otherwise trigger no-non-null-assertion).
    assert.doesNotMatch(result.stderr, /\[no-non-null-assertion\]/);
  };
