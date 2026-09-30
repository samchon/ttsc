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
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the actual engine and requires zero findings when the returns description continues on the following indented line.
// @evidence contracts/testing.md#independent-expectations JSDoc continuation prose belongs to the preceding @returns tag; an independently authored explanation satisfies the description policy despite the line break.
// @evidence contracts/testing.md#distinguishing-cases This is the wrapped-prose accepted boundary; TestRuleJSDocRequireReturnsDescription owns the incomplete tag and a same-line accepted description.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequireReturnsDescriptionAllowsMultilineContinuation is a discoverable Go unit using actual JSDoc parsing and in-process engine execution; no native artifact or documentation runtime is built.
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
