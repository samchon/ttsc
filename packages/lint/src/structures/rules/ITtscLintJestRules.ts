import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Jest test source rules from `eslint-plugin-jest`.
 *
 * Apply to TypeScript test files that use the Jest runner (`describe`,
 * `test`/`it`, `expect`, lifecycle hooks). They guard test-quality
 * patterns the type system cannot detect — unended assertions, focused
 * tests left behind, duplicate hook calls.
 *
 * @reference https://github.com/jest-community/eslint-plugin-jest
 */
export interface ITtscLintJestRules {
  /**
   * Require every Jest test body to contain at least one
   * `expect(...)` call. A test with no expectations passes silently.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/expect-expect.md
   */
  "jest/expect-expect"?: TtscLintRuleSetting;

  /**
   * Limit the number of `expect(...)` calls inside a single Jest test
   * body.
   *
   * A test packed with assertions usually verifies several behaviors
   * at once, making failures ambiguous — splitting per scenario keeps
   * each case diagnostic.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/max-expects.md
   */
  "jest/max-expects"?: TtscLintRuleSetting;

  /**
   * Reject `expect(...)` calls under `if`/`try`/`catch` or other
   * conditional branches in Jest tests.
   *
   * A branch that never executes turns the assertion into a silent
   * no-op, so the test passes without verifying anything.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-conditional-expect.md
   */
  "jest/no-conditional-expect"?: TtscLintRuleSetting;

  /**
   * Reject conditional logic (`if`/`switch`/ternary) inside Jest
   * test bodies.
   *
   * Each test should describe a single deterministic scenario;
   * branching hides which path the runner took when reading a
   * passing log.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-conditional-in-test.md
   */
  "jest/no-conditional-in-test"?: TtscLintRuleSetting;

  /**
   * Reject `test.skip`, `xit`, `xdescribe`, and other disabled Jest
   * tests.
   *
   * Skipped tests appear green in CI but quietly drop coverage for
   * the feature they were meant to pin, so they rot unseen.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-disabled-tests.md
   */
  "jest/no-disabled-tests"?: TtscLintRuleSetting;

  /**
   * Reject `done` callback parameters in Jest tests and hooks.
   *
   * The callback style predates async/await and makes error
   * propagation easy to miss — forgetting `done()` hangs the test
   * until timeout. Use `async`/`await` or return a Promise instead.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-done-callback.md
   */
  "jest/no-done-callback"?: TtscLintRuleSetting;

  /**
   * Reject duplicate setup/teardown hook calls
   * (`beforeEach`/`beforeAll`/etc.) within the same `describe`
   * block.
   *
   * Jest runs both copies in declaration order, which is almost
   * always a copy-paste mistake.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-duplicate-hooks.md
   */
  "jest/no-duplicate-hooks"?: TtscLintRuleSetting;

  /**
   * Reject `export` declarations in Jest test files.
   *
   * Tests are leaf consumers and should not expose helpers; the
   * runner silently skips test files with any export, so a stray
   * `export` can make a whole file disappear from the suite.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-export.md
   */
  "jest/no-export"?: TtscLintRuleSetting;

  /**
   * Reject `test.only`, `fit`, `fdescribe`, and other focused Jest
   * tests.
   *
   * A focused test silently skips every other test in the file, so
   * a stray `.only` left from debugging hides the rest of the suite
   * in CI.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-focused-tests.md
   */
  "jest/no-focused-tests"?: TtscLintRuleSetting;

  /**
   * Reject Jest setup/teardown hooks altogether.
   *
   * Promotes the style where each test arranges and tears down its
   * own state inline, so a reader can understand it in isolation
   * without scrolling to a distant `beforeEach`.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-hooks.md
   */
  "jest/no-hooks"?: TtscLintRuleSetting;

  /**
   * Reject duplicate test or `describe` titles at the same suite
   * level — the runner cannot distinguish two tests with the same
   * name in error output.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-identical-title.md
   */
  "jest/no-identical-title"?: TtscLintRuleSetting;

  /**
   * Reject `expect(...)` calls outside the body of a Jest test or
   * lifecycle hook.
   *
   * Top-level assertions execute at module load before any test
   * starts, so failures never attach to a named case in the runner's
   * report.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-standalone-expect.md
   */
  "jest/no-standalone-expect"?: TtscLintRuleSetting;

  /**
   * Reject `xit`, `fit`, `xdescribe`, `fdescribe`, and the rest of
   * the single-letter Jest test prefix aliases.
   *
   * They duplicate the `.only`/`.skip` variants but read as typos at
   * a glance, making accidental focus or disable harder to spot in
   * review.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-test-prefixes.md
   */
  "jest/no-test-prefixes"?: TtscLintRuleSetting;

  /**
   * Reject non-Promise `return` statements from Jest test bodies.
   *
   * Jest only awaits returned thenables, so a plain `return` value
   * is dropped and following code becomes dead — usually a symptom
   * of a missing `await` or an accidental early exit.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-test-return-statement.md
   */
  "jest/no-test-return-statement"?: TtscLintRuleSetting;

  /**
   * Prefer `expect(value).toHaveLength(n)` over asserting on
   * `value.length` directly with `toBe`.
   *
   * The dedicated matcher reports the actual length on failure
   * instead of a bare number mismatch with no context.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/prefer-to-have-length.md
   */
  "jest/prefer-to-have-length"?: TtscLintRuleSetting;

  /**
   * Require a message argument on `expect(...).toThrow(...)` so a
   * regression with a different error type still surfaces clearly.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/require-to-throw-message.md
   */
  "jest/require-to-throw-message"?: TtscLintRuleSetting;

  /**
   * Validate the shape of Jest `describe` callbacks.
   *
   * The callback must be synchronous and take no arguments — Jest
   * ignores returned Promises and `done`-style parameters at the
   * describe level, silently swallowing setup errors.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/valid-describe-callback.md
   */
  "jest/valid-describe-callback"?: TtscLintRuleSetting;

  /**
   * Validate `expect(...)` arity and matcher chaining: exactly one
   * argument, terminated by a matcher call, and async matchers
   * properly awaited.
   *
   * Malformed expects either throw at runtime or pass without
   * asserting anything.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/valid-expect.md
   */
  "jest/valid-expect"?: TtscLintRuleSetting;

  /**
   * Require non-empty static Jest test and `describe` titles.
   *
   * Empty or dynamically-built titles produce unreadable failure
   * output and break filter-by-name flags like `--testNamePattern`.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/valid-title.md
   */
  "jest/valid-title"?: TtscLintRuleSetting;
}
