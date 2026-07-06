import { assertAllLintCases } from "../../helpers/assertLintCase";

/**
 * Runs every annotated lint fixture discovered under `src/cases`.
 *
 * This corpus is data-driven because each fixture already declares its expected
 * diagnostics with `// expect:` comments. Adding or removing a lint rule case
 * should therefore happen in the fixture tree only; this test fails if the
 * corpus is empty and otherwise compares every reported diagnostic with the
 * annotation beside the source that triggered it.
 *
 * 1. Recursively discover annotated TypeScript fixtures in `src/cases`.
 * 2. Build the rule set for each fixture from its own `// expect:` comments.
 * 3. Assert the native lint output has exactly the annotated diagnostics.
 */
export const test_lint_rules_corpus_matches_expected_diagnostics = (): void => {
  assertAllLintCases();
};
