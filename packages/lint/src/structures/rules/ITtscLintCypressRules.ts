import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";
import type { ITtscLintCypressUnsafeToChainCommandRuleOptions } from "./ITtscLintCypressRuleOptions";

/**
 * Cypress end-to-end test rules.
 *
 * Static policies for syntactically named `cy.*` chains and Mocha-style test
 * callbacks. These rules do not execute the Cypress runner or resolve those
 * names to imported bindings.
 *
 * @reference https://github.com/cypress-io/eslint-plugin-cypress
 *
 * @evidence contracts/common.md#principled-implementation Optional cypress keys accept severity-only settings except unsafe-to-chain-command, whose tuple carries the typed command policy object.
 * @evidence contracts/common.md#clear-and-simple-design One family groups Cypress queue and test-body policies while reusing the common setting aliases and a separate configurable command schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cypress identifiers are the public configuration vocabulary; the command options enter through an explicit interface rather than consumer exceptions.
 * @evidence contracts/common.md#meaningful-documentation Family prose identifies the runner surface and member comments explain queue, assertion and debugging concerns; blank paragraphs and member boundaries follow documentation guidance.
 */
export interface ITtscLintCypressRules {
  /**
   * Require `should` or `and` in the screenshot's preceding chain, or a Cypress
   * assertion at the end of the immediately preceding sibling statement. The
   * check does not establish application stability or evaluate assertions.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/assertion-before-screenshot.md
   */
  "cypress/assertion-before-screenshot"?: TtscLintRuleSetting;

  /**
   * Prefer `cy.should()` over `.and()` when starting a Cypress assertion chain
   * — the native policy accepts an immediately preceding `should`, `and`, or
   * `contains` method.
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
   * Recognition follows the syntactic hook name and last function argument;
   * runner ordering is not executed or measured.
   *
   * @reference https://github.com/cypress-io/eslint-plugin-cypress/blob/master/docs/rules/no-async-before.md
   */
  "cypress/no-async-before"?: TtscLintRuleSetting;

  /**
   * Reject `async` callbacks in syntactically recognized `it`, `specify`, and
   * `test` calls, including named modifiers. The check does not observe queue
   * execution, promise completion, or the test's runtime result.
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
   * This checks the chain method name; it does not observe an attached debugger
   * or certify that a particular execution hangs.
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
   * Require supported static `cy.get()` selector forms to begin with a `data-*`
   * attribute selector or `@` alias. Literal strings, tracked const names,
   * supported templates, and conditional alternatives are inspected; unknown
   * expressions are skipped.
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
