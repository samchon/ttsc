import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type { ITtscLintCypressUnsafeToChainCommandRuleOptions } from "./ITtscLintCypressRuleOptions";

/**
 * Cypress end-to-end test rules.
 *
 * Apply to TypeScript/TSX sources that use the Cypress runner (`cy.*` commands
 * and Mocha-style `describe`/`it` blocks). Mirror the rule set from
 * `eslint-plugin-cypress` and detect Cypress-specific anti-patterns such as
 * async test bodies, missing assertions before screenshots, or deprecated XPath
 * selectors.
 *
 * @reference https://github.com/cypress-io/eslint-plugin-cypress
 *
 * @evidence contracts/common.md#principled-implementation Optional cypress keys accept severity-only settings except unsafe-to-chain-command, whose tuple carries the typed command policy object.
 * @evidence contracts/common.md#clear-and-simple-design One family groups Cypress queue and test-body policies while reusing the common setting aliases and a separate configurable command schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cypress identifiers are the public configuration vocabulary; the command options enter through an explicit interface rather than consumer exceptions.
 * @evidence contracts/common.md#meaningful-documentation Family prose identifies the runner surface and member comments explain queue, assertion and debugging concerns; blank paragraphs and member boundaries follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCypressRules is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCypressRules is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCypressRules is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCypressRules is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCypressRules {
  /**
   * Require at least one Cypress assertion (e.g. `cy.should(...)`) before each
   * `cy.screenshot()` call, so the captured screenshot reflects a stable
   * application state.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/assertion-before-screenshot.md
   */
  "cypress/assertion-before-screenshot"?: TtscLintRuleSetting;

  /**
   * Prefer `cy.should()` over `.and()` when starting a Cypress assertion chain
   * — `.and()` only makes sense after a preceding `.should()`.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-and.md
   */
  "cypress/no-and"?: TtscLintRuleSetting;

  /**
   * Reject assigning the return value of a Cypress command.
   *
   * Cypress commands are asynchronous wrappers; assignment yields a chainer
   * proxy rather than the underlying subject.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-assigning-return-values.md
   */
  "cypress/no-assigning-return-values"?: TtscLintRuleSetting;

  /**
   * Reject `async` Cypress `before` / `beforeEach` hooks.
   *
   * Cypress already serializes commands; an `async` hook breaks the runner's
   * ordering.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-async-before.md
   */
  "cypress/no-async-before"?: TtscLintRuleSetting;

  /**
   * Reject `async` Cypress `it`/`specify` test callbacks.
   *
   * Cypress builds a synchronous command queue when the test body runs and
   * replays it later; an `async` body resolves before the queue executes, so
   * the test reports success before any command has run.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-async-tests.md
   */
  "cypress/no-async-tests"?: TtscLintRuleSetting;

  /**
   * Reject chained `.get(...).get(...)` calls.
   *
   * Subsequent `.get()` calls do not narrow the previous subject; use a single
   * selector or `.find()`.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-chained-get.md
   */
  "cypress/no-chained-get"?: TtscLintRuleSetting;

  /**
   * Reject `cy.debug()` and chained `.debug()` commands.
   *
   * The helpers drop into the browser debugger and pause the runner
   * indefinitely — fine for local exploration but hangs CI when one slips into
   * a committed test.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-debug.md
   */
  "cypress/no-debug"?: TtscLintRuleSetting;

  /**
   * Reject `{ force: true }` on Cypress action commands such as `.click({
   * force: true })`. The option masks real UX issues.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-force.md
   */
  "cypress/no-force"?: TtscLintRuleSetting;

  /**
   * Reject `cy.pause()` and chained `.pause()` commands.
   *
   * They halt the Cypress runner until manually resumed, which is a
   * local-debugging affordance that hangs CI when committed.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-pause.md
   */
  "cypress/no-pause"?: TtscLintRuleSetting;

  /**
   * Reject numeric `cy.wait(ms)` sleeps — they create flaky tests. Wait on a
   * Cypress retry-aware assertion (`should`, `findBy*`, intercepted requests)
   * instead.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-unnecessary-waiting.md
   */
  "cypress/no-unnecessary-waiting"?: TtscLintRuleSetting;

  /**
   * Reject `cy.xpath(...)` selectors.
   *
   * The plugin shipping `cy.xpath` is deprecated, and XPath expressions tend to
   * encode brittle DOM structure rather than the semantic attributes Cypress
   * otherwise targets.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-xpath.md
   */
  "cypress/no-xpath"?: TtscLintRuleSetting;

  /**
   * Require `cy.get()` selectors to target a `data-*` attribute when the
   * selector is a string literal — separates testing concerns from styling.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/require-data-selectors.md
   */
  "cypress/require-data-selectors"?: TtscLintRuleSetting;

  /**
   * Reject chaining further Cypress commands after action commands (e.g.
   * `.click().then(...)`). Configurable per-command via the options object.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/unsafe-to-chain-command.md
   */
  "cypress/unsafe-to-chain-command"?: TtscLintRuleOptionsSetting<ITtscLintCypressUnsafeToChainCommandRuleOptions>;
}
