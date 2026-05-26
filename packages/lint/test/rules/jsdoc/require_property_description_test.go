package linthost

import "testing"

// TestRuleJSDocRequirePropertyDescription verifies jsdoc/require-property-description.
//
// Property docs are often attached to typedef blocks rather than AST members.
// A comment-only rule catches missing property prose without needing attachment.
//
// 1. Parse a TypeScript file with @property name and no description.
// 2. Enable jsdoc/require-property-description.
// 3. Assert the @property line is reported.
func TestRuleJSDocRequirePropertyDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-description", `/**
 * Options bag.
 * @property name
 */
export interface Options {
  name: string;
}
`, 3)
}
