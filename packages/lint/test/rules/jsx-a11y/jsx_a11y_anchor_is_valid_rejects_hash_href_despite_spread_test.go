package linthost

import "testing"

// TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread verifies spreads do not
// suppress explicit href violations.
//
// The conservative spread handling only applies to absence-predicated
// reports; an explicitly written `href="#"` is a violation on its own, and a
// sibling spread must not turn the rule off wholesale. This is the negative
// twin of the allows-spread-props case.
//
// 1. Parse an anchor with an explicit hash href plus a spread.
// 2. Enable only `jsx-a11y/anchor-is-valid`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify explicit hash href remains invalid beside a spread; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A real relative target satisfies navigation despite the same unknown spread. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Explicit href="#" reports despite unknown spread props; /docs with the same spread is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-is-valid", `declare const props: object; const Component = () => <a href="#" {...props}>documentation</a>;`, "valid navigation target")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", "declare const props: object; const Component = () => <a href=\"/docs\" {...props}>documentation</a>;")
}
