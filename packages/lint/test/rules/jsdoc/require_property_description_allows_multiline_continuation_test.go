package linthost

import "testing"

// TestRuleJSDocRequirePropertyDescriptionAllowsMultilineContinuation verifies jsdoc/require-property-description accepts continued prose.
//
// Property tags often wrap in typedef-style blocks. This pins the parser path
// that preserves an indented continuation as the preceding @property payload.
//
// 1. Parse a TypeScript file with @property name on one line.
// 2. Continue the property description on the following indented line.
// 3. Enable jsdoc/require-property-description and assert no findings.
func TestRuleJSDocRequirePropertyDescriptionAllowsMultilineContinuation(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-description", `/**
 * Options bag.
 * @property name
 *   Human-readable option name.
 */
export interface Options {
  name: string;
}
`)
}
