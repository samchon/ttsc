import { assertLintCase } from "../../helpers/assertLintCase";

/**
 * Verifies the consistent-indexed-object-style.ts lint fixture.
 *
 * This rule scenario owns one source fixture and its inline `// expect:`
 * annotations, making the covered rule and diagnostic anchor visible from the
 * file name rather than a dynamic corpus loop.
 *
 * 1. Read the fixture from `src/cases/consistent-indexed-object-style.ts`.
 * 2. Enable only the rules declared by its expectation comments.
 * 3. Compare the emitted @ttsc/lint diagnostics to those annotations.
 */
export const test_lint_rule_consistent_indexed_object_style = (): void => {
  assertLintCase("consistent-indexed-object-style.ts");
};
