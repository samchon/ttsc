package linthost

import "testing"

// TestRuleJSDocRequireParamName verifies jsdoc/require-param-name.
//
// TypeScript source comments can still contain JSDoc type braces. When the tag
// has only a type payload, the parameter name is missing and the rule reports it.
//
// 1. Parse a TypeScript file with @param {string}.
// 2. Enable jsdoc/require-param-name.
// 3. Assert the @param line is reported.
func TestRuleJSDocRequireParamName(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-name", `/**
 * Handles a name.
 * @param {string}
 */
export function handle(name: string): string {
  return name;
}
`, 3)
}
