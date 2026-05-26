package linthost

import "testing"

// TestRuleJSDocRequireParamDescription verifies jsdoc/require-param-description.
//
// The parser splits the optional type, parameter name, and trailing description
// from a single tag line. A named @param with no remaining description must fail.
//
// 1. Parse a TypeScript file with @param name and no description.
// 2. Enable jsdoc/require-param-description.
// 3. Assert the @param line is reported.
func TestRuleJSDocRequireParamDescription(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-description", `/**
 * Handles a name.
 * @param name
 */
export function handle(name: string): string {
  return name;
}
`, 3)
}
