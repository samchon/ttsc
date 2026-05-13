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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path =
  () => {
    const root = setupLintProject("lint-violations");
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-violations-"),
    );
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
