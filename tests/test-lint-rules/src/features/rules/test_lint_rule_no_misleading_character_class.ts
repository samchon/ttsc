import { assertLintCase } from "../../helpers/assertLintCase";

/**
 * Verifies the no-misleading-character-class.ts lint fixture.
 *
 * This rule scenario owns one source fixture and its inline `// expect:`
 * annotations, making the covered rule and diagnostic anchor visible from the
 * file name rather than a dynamic corpus loop.
 *
 * 1. Read the fixture from `src/cases/no-misleading-character-class.ts`.
 * 2. Enable only the rules declared by its expectation comments.
 * 3. Compare the emitted @ttsc/lint diagnostics to those annotations.
 */
export const test_lint_rule_no_misleading_character_class = (): void => {
  assertLintCase("no-misleading-character-class.ts");
};
