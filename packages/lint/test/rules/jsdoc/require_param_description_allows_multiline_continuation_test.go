package linthost

import "testing"

// TestRuleJSDocRequireParamDescriptionAllowsMultilineContinuation verifies jsdoc/require-param-description accepts continued prose.
//
// Parameter descriptions may wrap onto the next indented JSDoc line. This pins
// the parser path that attaches non-tag continuation lines to the preceding tag.
//
// 1. Parse a TypeScript file with @param name on one line.
// 2. Continue the parameter description on the following indented line.
// 3. Enable jsdoc/require-param-description and assert no findings.
func TestRuleJSDocRequireParamDescriptionAllowsMultilineContinuation(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-param-description", `/**
 * Handles a name.
 * @param name
 *   Normalized display name.
 */
export function handle(name: string): string {
  return name;
}
`)
}
