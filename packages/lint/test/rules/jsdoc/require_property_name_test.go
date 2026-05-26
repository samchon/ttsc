package linthost

import "testing"

// TestRuleJSDocRequirePropertyName verifies jsdoc/require-property-name.
//
// A @property tag with only a type cannot be matched to generated docs. The
// native rule therefore treats it as a malformed tag line.
//
// 1. Parse a TypeScript file with @property {string}.
// 2. Enable jsdoc/require-property-name.
// 3. Assert the @property line is reported.
func TestRuleJSDocRequirePropertyName(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-property-name", `/**
 * Options bag.
 * @property {string}
 */
export interface Options {
  name: string;
}
`, 3)
}
