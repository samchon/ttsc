package linthost

import "testing"

// TestJsxA11yAriaPropsRejectsUnknownProp verifies jsx-a11y/aria-props reports a
// misspelled aria-* attribute and accepts the canonical spelling.
//
// The rule is attribute-local and checks the aria-* name against the ARIA
// vocabulary before any role compatibility rule applies.
//
//  1. Run only `jsx-a11y/aria-props` over `<div aria-labeledby="title" />` and
//     expect one finding whose message contains "Unknown ARIA".
//  2. Run it over `<div aria-labelledby="title" />` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/aria-props enabled. The attribute aria-labeledby yields exactly one ordinary SeverityError finding from that rule whose message contains "Unknown ARIA"; assertJsxA11yRuleSkips requires zero findings for aria-labelledby.
// @evidence contracts/testing.md#independent-expectations The ARIA vocabulary spells the reference attribute aria-labelledby with two l characters, so the one-l spelling is unknown. The two literal sources and the "Unknown ARIA" fragment are authored from the ARIA specification.
// @evidence contracts/testing.md#distinguishing-cases The two divs share the title value and differ only in the attribute spelling. Other aria-* attributes are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAriaPropsRejectsUnknownProp(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-props", `const Component = () => <div aria-labeledby="title" />;`, "Unknown ARIA")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-props", "declare const props: object; const Component = () => <div aria-labelledby=\"title\" />;")
}
