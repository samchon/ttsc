/**
 * Options shapes for rules in {@link ITtscLintCypressRules} that accept
 * configuration. Only `cypress/unsafe-to-chain-command` is configurable in the
 * current native subset.
 *
 * @reference https://github.com/cypress-io/eslint-plugin-cypress
 */

/**
 * `cypress/unsafe-to-chain-command` rule options.
 *
 * @evidence contracts/common.md#principled-implementation An optional list represents additional unsafe action-command names, matching the native rule's extension of its built-in command classification.
 * @evidence contracts/common.md#clear-and-simple-design The single methods field exposes the one configurable decision without introducing an independent command registry.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Custom command treatment enters through the documented methods list rather than mutations of Cypress command objects.
 * @evidence contracts/common.md#meaningful-documentation The member explains that names are additional action commands and why later chaining matters; its default and prose are separated from tags.
 */
export interface ITtscLintCypressUnsafeToChainCommandRuleOptions {
  /**
   * Additional Cypress command names that should be treated as unsafe action
   * commands when another command is chained after them.
   *
   * @default [ ]
   */
  methods?: readonly string[];
}
