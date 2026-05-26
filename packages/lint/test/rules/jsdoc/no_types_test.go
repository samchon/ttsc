package linthost

import "testing"

// TestRuleJSDocNoTypes verifies jsdoc/no-types rejects duplicate TS types.
//
// @ttsc/lint only targets TypeScript sources here; parameter and return types
// already belong in syntax, so JSDoc type braces are redundant and can drift.
//
// 1. Parse a TypeScript file with a typed @param tag.
// 2. Enable jsdoc/no-types.
// 3. Assert the typed tag line is reported.
func TestRuleJSDocNoTypes(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/no-types", `/**
 * Handles a name.
 * @param {string} name description
 */
export function handle(name: string): string {
  return name;
}
`, 3)
}
