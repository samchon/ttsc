package linthost

import "testing"

// TestRuleJSDocRejectAnyType verifies jsdoc/reject-any-type rejects any.
//
// This is a content check over JSDoc type braces. It catches weak doc types even
// when jsdoc/no-types is not enabled in a project.
//
// 1. Parse a TypeScript file with @param {any}.
// 2. Enable jsdoc/reject-any-type.
// 3. Assert the @param line is reported.
func TestRuleJSDocRejectAnyType(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-any-type", `/**
 * Handles an input.
 * @param {any} value description
 */
export function handle(value: unknown): unknown {
  return value;
}
`, 3)
}
