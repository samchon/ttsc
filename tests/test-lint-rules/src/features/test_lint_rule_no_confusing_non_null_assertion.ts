import { assertLintCase } from "../helpers/assertLintCase";

/**
 * Verifies the no-confusing-non-null-assertion.ts lint fixture.
 *
 * This rule scenario owns one source fixture and its inline `// expect:`
 * annotations, making the covered rule and diagnostic anchor visible from the
 * file name rather than a dynamic corpus loop.
 *
 * 1. Read the fixture from `src/cases/no-confusing-non-null-assertion.ts`.
 * 2. Enable only the rules declared by its expectation comments.
 * 3. Compare the emitted @ttsc/lint diagnostics to those annotations.
 */
export const test_lint_rule_no_confusing_non_null_assertion = (): void => {
  assertLintCase("no-confusing-non-null-assertion.ts");
};
