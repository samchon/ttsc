package linthost

import "testing"

// TestRuleJSDocRejectFunctionType verifies jsdoc/reject-function-type rejects Function.
//
// The unsafe Function type is equally weak in JSDoc and TypeScript syntax.
// The rule therefore scans the JSDoc type payload directly and reports it.
//
// 1. Parse a TypeScript file with @param {Function}.
// 2. Enable jsdoc/reject-function-type.
// 3. Assert the @param line is reported.
func TestRuleJSDocRejectFunctionType(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-function-type", `/**
 * Registers a callback.
 * @param {Function} handler description
 */
export function register(handler: () => void): void {
  handler();
}
`, 3)
}
