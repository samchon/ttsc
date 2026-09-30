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
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the actual engine and requires zero findings when the param description continues on the following indented line.
// @evidence contracts/testing.md#independent-expectations JSDoc continuation prose belongs to the preceding @param tag; an independently authored explanation satisfies the description policy despite the line break.
// @evidence contracts/testing.md#distinguishing-cases This is the wrapped-prose accepted boundary; TestRuleJSDocRequireParamDescription owns the incomplete tag and a same-line accepted description.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRequireParamDescriptionAllowsMultilineContinuation is a discoverable Go unit using actual JSDoc parsing and in-process engine execution; no native artifact or documentation runtime is built.
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
