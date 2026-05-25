package linthost

import "testing"

// TestRuleJSDocRequireReturnsDescriptionAllowsMultilineContinuation verifies jsdoc/require-returns-description accepts continued prose.
//
// Return descriptions may sit below a typed @returns line. This pins the parser
// path that appends the continuation before the description rule checks payloads.
//
// 1. Parse a TypeScript file with @returns {number} on one line.
// 2. Continue the return description on the following indented line.
// 3. Enable jsdoc/require-returns-description and assert no findings.
func TestRuleJSDocRequireReturnsDescriptionAllowsMultilineContinuation(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/require-returns-description", `/**
 * Computes a value.
 * @returns {number}
 *   Rounded total.
 */
export function compute(): number {
  return 1;
}
`)
}
