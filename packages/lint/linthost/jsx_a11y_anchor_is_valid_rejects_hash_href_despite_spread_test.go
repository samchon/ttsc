package linthost

import "testing"

// TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread verifies a spread does
// not suppress an explicit invalid href in jsx-a11y/anchor-is-valid.
//
// The conservative spread handling applies only to reports about an absent
// attribute; an explicitly written `href="#"` is a violation on its own.
//
//  1. Run only `jsx-a11y/anchor-is-valid` over `<a href="#" {...props}>` and
//     expect one finding whose message contains "valid navigation target".
//  2. Run it over `<a href="/docs" {...props}>` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/anchor-is-valid enabled. The anchor with href="#" and a spread yields exactly one ordinary SeverityError finding from that rule whose message contains "valid navigation target"; assertJsxA11yRuleSkips requires zero findings for href="/docs" with the same spread.
// @evidence contracts/testing.md#independent-expectations The lint policy reports an explicitly authored hash-only placeholder despite an unknown spread, and accepts the authored /docs path. Literal fixtures and the message fragment independently pin that static policy; the test does not certify browser navigation, destination existence or the final runtime spread value.
// @evidence contracts/testing.md#distinguishing-cases The two sources keep the same spread and differ only in the href value, so the spread cannot be what silences or triggers the report. The spread-only anchor is covered by TestJsxA11yAnchorIsValidAllowsSpreadProps.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-is-valid", `declare const props: object; const Component = () => <a href="#" {...props}>documentation</a>;`, "valid navigation target")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", "declare const props: object; const Component = () => <a href=\"/docs\" {...props}>documentation</a>;")
}
