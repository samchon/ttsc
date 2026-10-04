import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Jest test source rules from `eslint-plugin-jest`.
 *
 * Apply to TypeScript test files that use the Jest runner (`describe`,
 * `test`/`it`, `expect`, lifecycle hooks). They guard test-quality patterns the
 * type system cannot detect — unended assertions, focused tests left behind,
 * duplicate hook calls.
 *
 * @reference https://github.com/jest-community/eslint-plugin-jest
 *
 * @evidence contracts/common.md#principled-implementation Optional jest keys map to the common severity-only union, so each policy can be omitted or configured without implying an unsupported options slot.
 * @evidence contracts/common.md#clear-and-simple-design One interface collects Jest source policies while severity spelling and tuple forms remain defined in the shared alias.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Named Jest policies use the supported setting representation and introduce no special configuration path for repository test fixtures.
 * @evidence contracts/common.md#meaningful-documentation Family prose identifies Jest source and member comments explain assertion, lifecycle and collection concerns; separate paragraphs and members follow documentation guidance.
 */
export interface ITtscLintJestRules {
  /**
   * Require every Jest test body to contain at least one `expect(...)` call. A
   * test with no expectations passes silently.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/expect-expect.md
   */
  "jest/expect-expect"?: TtscLintRuleSetting;

  /**
   * Report more than five recognized expect calls in a Jest test body using
   * the native callback-body walker; this interface exposes no limit option.
   *
   * A test packed with assertions usually verifies several behaviors at once,
   * making failures ambiguous — splitting per scenario keeps each case
   * diagnostic.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/max-expects.md
   */
  "jest/max-expects"?: TtscLintRuleSetting;

  /**
   * Reject recognized expect calls under if, switch, or ternary syntax in
   * recognized Jest test callbacks. Try/catch are not native conditional kinds.
   *
   * A branch that never executes turns the assertion into a silent no-op, so
   * the test passes without verifying anything.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-conditional-expect.md
   */
  "jest/no-conditional-expect"?: TtscLintRuleSetting;

  /**
   * Reject conditional logic (`if`/`switch`/ternary) inside Jest test bodies.
   *
   * Each test should describe a single deterministic scenario; branching hides
   * which path the runner took when reading a passing log.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-conditional-in-test.md
   */
  "jest/no-conditional-in-test"?: TtscLintRuleSetting;

  /**
   * Reject `test.skip`, `xit`, `xdescribe`, and other disabled Jest tests.
   *
   * Skipped tests appear green in CI but quietly drop coverage for the feature
   * they were meant to pin, so they rot unseen.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-disabled-tests.md
   */
  "jest/no-disabled-tests"?: TtscLintRuleSetting;

  /**
   * Reject `done` callback parameters in Jest tests and hooks.
   *
   * The callback style predates async/await and makes error propagation easy to
   * miss — forgetting `done()` hangs the test until timeout. Use
   * `async`/`await` or return a Promise instead.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-done-callback.md
   */
  "jest/no-done-callback"?: TtscLintRuleSetting;

  /**
   * Reject duplicate setup/teardown hook calls (`beforeEach`/`beforeAll`/etc.)
   * within the same `describe` block.
   *
   * Jest runs both copies in declaration order, which is almost always a
   * copy-paste mistake.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-duplicate-hooks.md
   */
  "jest/no-duplicate-hooks"?: TtscLintRuleSetting;

  /**
   * Reject `export` declarations in Jest test files.
   *
   * Keep reusable helpers in separate modules so importing a helper does not
   * also load the test declarations in this file. This is an organization
   * policy, not a claim that Jest refuses modules with exports.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-export.md
   */
  "jest/no-export"?: TtscLintRuleSetting;

  /**
   * Reject `test.only`, `fit`, `fdescribe`, and other focused Jest tests.
   *
   * A focused test silently skips every other test in the file, so a stray
   * `.only` left from debugging hides the rest of the suite in CI.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-focused-tests.md
   */
  "jest/no-focused-tests"?: TtscLintRuleSetting;

  /**
   * Reject Jest setup/teardown hooks altogether.
   *
   * Promotes the style where each test arranges and tears down its own state
   * inline, so a reader can understand it in isolation without scrolling to a
   * distant `beforeEach`.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-hooks.md
   */
  "jest/no-hooks"?: TtscLintRuleSetting;

  /**
   * Reject duplicate test or `describe` titles at the same suite level — the
   * runner cannot distinguish two tests with the same name in error output.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-identical-title.md
   */
  "jest/no-identical-title"?: TtscLintRuleSetting;

  /**
   * Report top-level expect calls and calls whose nearest function is an
   * argument of a non-test call. Unattached helper functions are skipped;
   * lifecycle hooks are not separately exempted by the native check.
   *
   * Top-level assertions execute at module load before any test starts, so
   * failures never attach to a named case in the runner's report.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-standalone-expect.md
   */
  "jest/no-standalone-expect"?: TtscLintRuleSetting;

  /**
   * Reject `xit`, `fit`, `xdescribe`, `fdescribe`, and the rest of the
   * single-letter Jest test prefix aliases.
   *
   * They duplicate the `.only`/`.skip` variants but read as typos at a glance,
   * making accidental focus or disable harder to spot in review.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-test-prefixes.md
   */
  "jest/no-test-prefixes"?: TtscLintRuleSetting;

  /**
   * Reject explicit return statements in recognized Jest test bodies, including
   * bare returns and returned Promises; the native check does not infer types.
   *
   * This is a source policy rather than observation of runner completion.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/no-test-return-statement.md
   */
  "jest/no-test-return-statement"?: TtscLintRuleSetting;

  /**
   * Prefer `expect(value).toHaveLength(n)` over asserting on `value.length`
   * directly with `toBe`.
   *
   * The dedicated matcher reports the actual length on failure instead of a
   * bare number mismatch with no context.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/prefer-to-have-length.md
   */
  "jest/prefer-to-have-length"?: TtscLintRuleSetting;

  /**
   * Require a message argument on `expect(...).toThrow(...)` so a regression
   * with a different error type still surfaces clearly.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/require-to-throw-message.md
   */
  "jest/require-to-throw-message"?: TtscLintRuleSetting;

  /**
   * Validate the shape of Jest `describe` callbacks.
   *
   * The native check requires a function callback without an async modifier.
   * It does not validate parameter count or infer returned Promise types.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/valid-describe-callback.md
   */
  "jest/valid-describe-callback"?: TtscLintRuleSetting;

  /**
   * Validate `expect(...)` arity and matcher chaining: exactly one argument,
   * terminated by a member call. Asynchronous handling is not validated.
   *
   * Malformed expects either throw at runtime or pass without asserting
   * anything.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/valid-expect.md
   */
  "jest/valid-expect"?: TtscLintRuleSetting;

  /**
   * Require non-empty static Jest test and `describe` titles.
   *
   * Empty or dynamically-built titles produce unreadable failure output and
   * break filter-by-name flags like `--testNamePattern`.
   *
   * @reference https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/valid-title.md
   */
  "jest/valid-title"?: TtscLintRuleSetting;
}
