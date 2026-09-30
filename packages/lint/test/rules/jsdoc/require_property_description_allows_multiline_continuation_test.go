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
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the actual engine and requires zero findings when the property description continues on the following indented line.
// @evidence contracts/testing.md#independent-expectations JSDoc continuation prose belongs to the preceding @property tag; an independently authored explanation satisfies the description policy despite the line break.
// @evidence contracts/testing.md#distinguishing-cases This is the wrapped-prose accepted boundary; TestRuleJSDocRequirePropertyDescription owns the incomplete tag and a same-line accepted description.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequirePropertyDescriptionAllowsMultilineContinuation is a discoverable Go unit using actual JSDoc parsing and in-process engine execution; no native artifact or documentation runtime is built.
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
