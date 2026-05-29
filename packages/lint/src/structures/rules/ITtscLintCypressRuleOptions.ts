/**
 * Options shapes for rules in {@link ITtscLintCypressRules} that accept
 * configuration. Only `cypress/unsafe-to-chain-command` is configurable in the
 * current native subset.
 *
 * @reference https://github.com/cypress-io/eslint-plugin-cypress
 */

/** `cypress/unsafe-to-chain-command` rule options. */
export interface ITtscLintCypressUnsafeToChainCommandRuleOptions {
  /**
   * Additional Cypress command names that should be treated as unsafe action
   * commands when another command is chained after them.
   *
   * @default [ ]
   */
  methods?: readonly string[];
}
