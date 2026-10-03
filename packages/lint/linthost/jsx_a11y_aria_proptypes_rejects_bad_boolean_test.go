package linthost

import "testing"

// TestJsxA11yAriaProptypesRejectsBadBoolean verifies jsx-a11y/aria-proptypes
// reports a non-boolean string literal on a boolean ARIA attribute and accepts
// a boolean literal.
//
// The rule checks known string literals against the attribute's value shape and
// leaves dynamic expressions alone.
//
// 1. Run only `jsx-a11y/aria-proptypes` over `<div aria-hidden="maybe" />` and
//    expect one finding whose message contains "true or false".
// 2. Run it over `<div aria-hidden="false" />` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/aria-proptypes enabled. aria-hidden="maybe" yields exactly one ordinary SeverityError finding from that rule whose message contains "true or false"; assertJsxA11yRuleSkips requires zero findings for aria-hidden="false".
// @evidence contracts/testing.md#independent-expectations The ARIA boolean attributes accept the tokens true and false, so "maybe" is invalid and "false" is valid. The two literal sources and the message fragment are authored from that vocabulary.
// @evidence contracts/testing.md#distinguishing-cases The two divs differ only in the aria-hidden literal. Dynamic expressions, the tristate and numeric attribute families are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAriaProptypesRejectsBadBoolean(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-proptypes", `const Component = () => <div aria-hidden="maybe" />;`, "true or false")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-proptypes", "declare const props: object; const Component = () => <div aria-hidden=\"false\" />;")
}
