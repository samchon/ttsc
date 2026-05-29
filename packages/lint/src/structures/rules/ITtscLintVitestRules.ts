import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Vitest test source rules from `@vitest/eslint-plugin`.
 *
 * Vitest reuses much of Jest's testing surface but ships its own runner and
 * configuration. These rules mirror the ergonomic subset of
 * `eslint-plugin-jest` adapted for Vitest semantics — focused tests, identical
 * titles, conditional logic, valid `expect` shape.
 *
 * @reference https://github.com/vitest-dev/eslint-plugin-vitest
 */
export interface ITtscLintVitestRules {
  /**
   * Require every Vitest test body to contain at least one `expect(...)` call.
   * A test with no assertions still passes, giving a false-positive signal.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/expect-expect.md
   */
  "vitest/expect-expect"?: TtscLintRuleSetting;

  /**
   * Reject `expect(...)` calls under `if`/`try`/`catch` or other conditional
   * branches in Vitest tests.
   *
   * A branch that never runs turns the assertion into a silent no-op rather
   * than a failure.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-conditional-expect.md
   */
  "vitest/no-conditional-expect"?: TtscLintRuleSetting;

  /**
   * Reject `test(...)`/`it(...)` declarations inside loops or `if` branches.
   *
   * Vitest collects tests at module load, so a conditional declaration produces
   * a different suite shape than the file appears to describe.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-conditional-tests.md
   */
  "vitest/no-conditional-tests"?: TtscLintRuleSetting;

  /**
   * Reject `test.skip`, `it.skip`, `describe.skip`, and `.todo` variants.
   *
   * Disabled tests rot in place and quietly drop coverage for the feature they
   * were meant to pin.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-disabled-tests.md
   */
  "vitest/no-disabled-tests"?: TtscLintRuleSetting;

  /**
   * Reject `done` callback parameters in Vitest tests and lifecycle hooks.
   *
   * The callback style predates async/await and makes failure propagation easy
   * to miss; return a Promise or mark the body `async` instead.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-done-callback.md
   */
  "vitest/no-done-callback"?: TtscLintRuleSetting;

  /**
   * Reject `test.only`, `it.only`, and `describe.only`.
   *
   * A focused suite silently skips the rest of the file, so a stray `.only`
   * left from debugging hides every other test in CI.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-focused-tests.md
   */
  "vitest/no-focused-tests"?: TtscLintRuleSetting;

  /**
   * Reject duplicate Vitest test or `describe` titles within the same suite
   * scope.
   *
   * The runner cannot disambiguate two siblings with identical names in its
   * error output or filter flags.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-identical-title.md
   */
  "vitest/no-identical-title"?: TtscLintRuleSetting;

  /**
   * Reject `expect(...)` calls outside Vitest tests and hooks.
   *
   * Top-level assertions execute at module load before any test starts, so
   * failures never attach to a named case.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-standalone-expect.md
   */
  "vitest/no-standalone-expect"?: TtscLintRuleSetting;

  /**
   * Reject `return` statements that return non-Promise values from a Vitest
   * test callback.
   *
   * The runner ignores the value and following code is dead, which usually
   * masks a missing `await` or stray early-exit.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/no-test-return-statement.md
   */
  "vitest/no-test-return-statement"?: TtscLintRuleSetting;

  /**
   * Prefer `expect(value).toHaveLength(n)` over asserting on `value.length`
   * with `toBe`.
   *
   * The dedicated matcher reports the actual length on failure instead of a
   * bare number mismatch.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/prefer-to-have-length.md
   */
  "vitest/prefer-to-have-length"?: TtscLintRuleSetting;

  /**
   * Validate the shape of Vitest `describe` callbacks.
   *
   * The callback must be synchronous and take no arguments — the runner ignores
   * returned Promises and `done`-style parameters at the describe level.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/valid-describe-callback.md
   */
  "vitest/valid-describe-callback"?: TtscLintRuleSetting;

  /**
   * Validate `expect(...)` arity and matcher chaining: exactly one argument,
   * terminated by a matcher call, and async matchers properly awaited.
   *
   * Malformed expects either throw at runtime or pass without asserting
   * anything.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/valid-expect.md
   */
  "vitest/valid-expect"?: TtscLintRuleSetting;

  /**
   * Require non-empty static Vitest test and `describe` titles.
   *
   * Empty or dynamically-built titles produce unreadable failure output and
   * break filter-by-name flags.
   *
   * @reference https://github.com/vitest-dev/eslint-plugin-vitest/blob/main/docs/rules/valid-title.md
   */
  "vitest/valid-title"?: TtscLintRuleSetting;
}
