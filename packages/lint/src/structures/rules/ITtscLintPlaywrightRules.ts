import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Playwright end-to-end test rules from `eslint-plugin-playwright`,
 * applied to TypeScript test files driven by the `@playwright/test`
 * runner.
 *
 * Guard Playwright-specific patterns — locator usage, web-first
 * assertions, focused/slowed tests — that would otherwise compile
 * and run silently.
 *
 * @reference https://github.com/playwright-community/eslint-plugin-playwright
 */
export interface ITtscLintPlaywrightRules {
  /**
   * Require every Playwright test body to contain at least one
   * `expect(...)` call. A test with no assertions still passes,
   * giving a false-positive signal.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/expect-expect.md
   */
  "playwright/expect-expect"?: TtscLintRuleSetting;

  /**
   * Limit the assertion count inside a single Playwright test body.
   *
   * A test packed with assertions usually verifies several user
   * flows at once, making failures ambiguous — splitting per
   * scenario keeps each case diagnostic.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/max-expects.md
   */
  "playwright/max-expects"?: TtscLintRuleSetting;

  /**
   * Reject `expect(...)` calls under `if`/`try`/`catch` or other
   * conditional branches in Playwright tests.
   *
   * A branch that never executes turns the assertion into a silent
   * no-op, so the test passes without verifying anything.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-conditional-expect.md
   */
  "playwright/no-conditional-expect"?: TtscLintRuleSetting;

  /**
   * Reject conditional logic (`if`/`switch`/ternary) inside
   * Playwright test bodies.
   *
   * Each test should describe a single deterministic user flow;
   * branching hides which path the runner took when reading a
   * passing log.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-conditional-in-test.md
   */
  "playwright/no-conditional-in-test"?: TtscLintRuleSetting;

  /**
   * Reject duplicate Playwright setup/teardown hook calls
   * (`test.beforeEach`/`test.afterEach`/etc.) in the same
   * `test.describe`.
   *
   * Playwright runs both copies in declaration order, almost always
   * a copy-paste mistake.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-duplicate-hooks.md
   */
  "playwright/no-duplicate-hooks"?: TtscLintRuleSetting;

  /**
   * Reject repeated `test.slow()` calls inside the same test —
   * the first call already marks the test slow.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-duplicate-slow.md
   */
  "playwright/no-duplicate-slow"?: TtscLintRuleSetting;

  /**
   * Reject the legacy `ElementHandle`-style Playwright API
   * (`page.$`, `page.$$`).
   *
   * Handles snapshot the DOM at query time and bypass Playwright's
   * auto-waiting; locators are the modern retry-aware replacement.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-element-handle.md
   */
  "playwright/no-element-handle"?: TtscLintRuleSetting;

  /**
   * Reject `page.$eval` and `page.$$eval`.
   *
   * They depend on the legacy handle API and run user-supplied
   * selectors against a frozen snapshot of the DOM — use
   * `locator.evaluate` or inline logic in the test instead.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-eval.md
   */
  "playwright/no-eval"?: TtscLintRuleSetting;

  /**
   * Reject `test.only`, `test.describe.only`, and similar focused
   * Playwright tests.
   *
   * A focused test silently skips every other test in the file, so
   * a stray `.only` left from debugging hides the rest of the suite
   * in CI.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-focused-test.md
   */
  "playwright/no-focused-test"?: TtscLintRuleSetting;

  /**
   * Reject Playwright `{ force: true }` options on actionable
   * commands (`click`, `fill`, ...).
   *
   * `force` skips the actionability checks Playwright relies on for
   * stability, usually papering over a real UI bug the test should
   * be exposing.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-force-option.md
   */
  "playwright/no-force-option"?: TtscLintRuleSetting;

  /**
   * Reject `getByTitle(...)` locators.
   *
   * The `title` attribute is rarely set with testing in mind and
   * often changes for i18n or cosmetic reasons, making title-based
   * selectors among the least stable test targets.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-get-by-title.md
   */
  "playwright/no-get-by-title"?: TtscLintRuleSetting;

  /**
   * Reject Playwright `test.beforeEach`/`test.afterEach`/etc.
   * hooks.
   *
   * Promotes the style where each test arranges and tears down its
   * own state inline, so a reader can understand a single case
   * without scrolling to a distant hook.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-hooks.md
   */
  "playwright/no-hooks"?: TtscLintRuleSetting;

  /**
   * Reject nested `test.step(...)` calls.
   *
   * Playwright's trace viewer collapses steps into a flat timeline,
   * so nested steps are hard to read and usually signal that the
   * inner step should live in its own top-level entry.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-nested-step.md
   */
  "playwright/no-nested-step"?: TtscLintRuleSetting;

  /**
   * Reject the `networkidle` load-state in `page.waitForLoadState`
   * and navigation options.
   *
   * Modern apps stream requests on a keep-alive socket so the state
   * is racy; the Playwright team recommends waiting on a locator
   * instead.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-networkidle.md
   */
  "playwright/no-networkidle"?: TtscLintRuleSetting;

  /**
   * Reject `.first()`, `.last()`, and `.nth(...)` on locators.
   *
   * Positional access couples the test to current DOM ordering and
   * breaks the moment the layout changes — prefer a more specific
   * locator (role, label, test id) that names the target directly.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-nth-methods.md
   */
  "playwright/no-nth-methods"?: TtscLintRuleSetting;

  /**
   * Reject `page.pause()` debugging calls.
   *
   * The helper drops the runner into Playwright's inspector, which
   * is useful locally but hangs CI indefinitely if it slips into a
   * committed test.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-page-pause.md
   */
  "playwright/no-page-pause"?: TtscLintRuleSetting;

  /**
   * Reject `test.skip`, `test.describe.skip`, and the conditional
   * `test.skip()` annotation.
   *
   * Skipped tests appear green in CI but quietly drop coverage for
   * the feature they were meant to pin.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-skipped-test.md
   */
  "playwright/no-skipped-test"?: TtscLintRuleSetting;

  /**
   * Reject `test.slow()` marks on Playwright tests.
   *
   * The annotation triples the per-test timeout, usually masking a
   * real performance regression instead of fixing the underlying
   * wait.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-slowed-test.md
   */
  "playwright/no-slowed-test"?: TtscLintRuleSetting;

  /**
   * Reject `expect(...)` calls outside the body of a Playwright
   * test or lifecycle hook.
   *
   * Top-level assertions execute at module load before any test
   * starts, so failures never attach to a named case in the runner's
   * report.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-standalone-expect.md
   */
  "playwright/no-standalone-expect"?: TtscLintRuleSetting;

  /**
   * Reject `page.waitForNavigation`.
   *
   * The helper races against navigations triggered by the very
   * command preceding it; use a locator-based wait or the action's
   * own `waitUntil` option to pin the post-navigation state
   * explicitly.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-wait-for-navigation.md
   */
  "playwright/no-wait-for-navigation"?: TtscLintRuleSetting;

  /**
   * Reject `page.waitForSelector`.
   *
   * The helper duplicates locator auto-waiting but does not share
   * its retry semantics — prefer `locator.waitFor()` or a web-first
   * assertion on the same locator.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-wait-for-selector.md
   */
  "playwright/no-wait-for-selector"?: TtscLintRuleSetting;

  /**
   * Reject `page.waitForTimeout(ms)` sleeps.
   *
   * A hardcoded delay is either too short under load (flaky
   * failures) or too long under normal conditions (slow suite); wait
   * on a locator or response that signals readiness directly.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/no-wait-for-timeout.md
   */
  "playwright/no-wait-for-timeout"?: TtscLintRuleSetting;

  /**
   * Prefer locator-based Playwright APIs (`page.locator(sel).click()`)
   * over page-level convenience methods (`page.click(selector)`).
   *
   * Page methods re-resolve the selector each call and skip the
   * retry semantics that make locators robust under animation.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-locator.md
   */
  "playwright/prefer-locator"?: TtscLintRuleSetting;

  /**
   * Prefer `expect(locator).toHaveCount(n)` over asserting on
   * `await locator.count()`.
   *
   * The web-first matcher retries until the count stabilizes, while
   * the awaited value is a one-shot snapshot that races against
   * ongoing renders.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-to-have-count.md
   */
  "playwright/prefer-to-have-count"?: TtscLintRuleSetting;

  /**
   * Prefer `expect(value).toHaveLength(n)` over asserting on
   * `value.length` directly.
   *
   * The dedicated matcher reports the actual length on failure
   * instead of a bare number mismatch.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-to-have-length.md
   */
  "playwright/prefer-to-have-length"?: TtscLintRuleSetting;

  /**
   * Prefer Playwright web-first assertions
   * (`expect(locator).toBeVisible()`, `.toHaveText(...)`) over
   * composed manual waits.
   *
   * Web-first matchers retry until the predicate holds, which is how
   * Playwright keeps tests stable under animation and network
   * jitter.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md
   */
  "playwright/prefer-web-first-assertions"?: TtscLintRuleSetting;

  /**
   * Require an explicit `timeout` option on `expect(...).toPass(...)`.
   *
   * The matcher otherwise inherits the suite-wide timeout and can
   * strand CI when the underlying assertion never settles.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/require-to-pass-timeout.md
   */
  "playwright/require-to-pass-timeout"?: TtscLintRuleSetting;

  /**
   * Require a message argument on `expect(...).toThrow(...)`.
   *
   * Without a message the assertion only confirms that something
   * threw, so a regression that throws a different error still looks
   * green.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/require-to-throw-message.md
   */
  "playwright/require-to-throw-message"?: TtscLintRuleSetting;

  /**
   * Validate the shape of Playwright `test.describe` callbacks.
   *
   * The callback must be synchronous and take no arguments —
   * Playwright ignores returned Promises and stray parameters at the
   * describe level, silently swallowing setup errors.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/valid-describe-callback.md
   */
  "playwright/valid-describe-callback"?: TtscLintRuleSetting;

  /**
   * Validate `expect(...)` arity and matcher chaining: exactly one
   * argument, terminated by a matcher call, and async matchers
   * properly awaited.
   *
   * Malformed expects either throw at runtime or pass without
   * asserting anything.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/valid-expect.md
   */
  "playwright/valid-expect"?: TtscLintRuleSetting;

  /**
   * Require non-empty static Playwright test and `describe`
   * titles.
   *
   * Empty or dynamically-built titles produce unreadable reports and
   * break filter-by-name flags like `--grep`.
   *
   * @reference https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/valid-title.md
   */
  "playwright/valid-title"?: TtscLintRuleSetting;
}
