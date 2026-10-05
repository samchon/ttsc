import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
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
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint surfaces rule violations through the
 * normal failure path.
 *
 * The fixture carries eight inline `// expect:` annotations. The test checks
 * their rule/severity/line membership against parsed stderr banners in both
 * directions and the disabled rule's literal absence. It does not establish a
 * bijection, count duplicate identical banners or reject every unparsed line.
 *
 * 1. Copy the `lint-violations` fixture (which contains `// expect:` comments).
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert non-zero exit, that every annotated violation appears in stderr, that
 *    no unannotated parsed banner appears, and that `[no-non-null-assertion]`
 *    (the `off` rule) is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --noEmit returns failure and matches every parsed fixture rule/severity/line expectation in both directions while the off rule stays absent.
 * @evidence contracts/testing.md#independent-expectations Authored expect comments and lint config establish the rule, severity and source line before diagnostics run; the expected set is not derived from stderr.
 * @evidence contracts/testing.md#distinguishing-cases Enabled errors/warnings and an off no-non-null-assertion rule share one consumer check; membership comparisons do not independently count duplicate identical diagnostics.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path entry is discovered by TestExecutor from corpus-ttsc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary One public CLI activates the workspace-linked lint/native host and carries rule/severity/source-line observations into rendered banners. All eight authored expectations and the disabled marker are preserved, with the stated parser/membership limits. Portable rule meanings retain separate exact unit selection/survival obligations and are not certified by this output.
 * @evidence contracts/e2e.md#shared-execution One copied consumer and one public --noEmit request carry the original eight-annotation corpus. The unchanged workspace producer and explicit suite-owned cache are available for reuse; this output does not count actual builds/Programs/processes, prove a hit/no rebuild or establish minimum preparation cost. Workspace linkage is not a packed installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the consumer; shared suite cache/workspace producer are not consumer cleanup targets. Error, signal and numeric nonzero status distinguish launch failure from actual lint rejection. Authored expectation population is checked nonempty/exactly eight before matching. Synchronous return does not certify arbitrary descendants or loaded-image equality; child-specific PATH/cache settings leave ambient state unchanged.
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
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(typeof result.status, "number");
    assert.notEqual(result.status, 0, "expected lint errors to fail the build");

    // Build the expected diagnostic set from `// expect:` annotations in
    // the fixture. Every annotation pins (rule, severity) at the next
    // non-comment, non-blank line — the renderer's `path:line:col` banner
    // must match the line we annotated.
    const sourcePath = path.join(root, "src", "main.ts");
    const expected = parseExpectations(sourcePath);
    assert.equal(
      expected.length,
      8,
      "expected the complete authored lint annotation population",
    );
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
