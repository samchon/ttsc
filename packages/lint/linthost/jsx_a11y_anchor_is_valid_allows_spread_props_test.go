package linthost

import "testing"

// TestJsxA11yAnchorIsValidAllowsSpreadProps verifies jsx-a11y/anchor-is-valid
// stays quiet for an anchor whose only attribute is a spread.
//
// The href may arrive through `{...props}`, so the missing-href report must not
// fire; this also guards the former crash of the attribute walk on spread
// members.
//
// 1. Run only `jsx-a11y/anchor-is-valid` over `<a {...props}>documentation</a>`.
// 2. Require no finding, which also fails on a recovered rule panic.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleSkips parses the TSX source and runs NewEngine.Run with only jsx-a11y/anchor-is-valid enabled at error severity. The Test requires zero findings for the spread-only anchor, so a missing-href report and an engine-failure finding produced by a recovered panic would both fail it.
// @evidence contracts/testing.md#independent-expectations A spread may supply href, so its absence cannot be proven statically and must not be reported. The authored source and the zero expectation follow from that policy rather than from sampling rule output.
// @evidence contracts/testing.md#distinguishing-cases This is the spread-accepted case with no explicit href. TestJsxA11yAnchorIsValidRejectsHashHrefDespiteSpread covers an explicit invalid href beside a spread, and the hash-href Test covers it without a spread.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleSkips call, executing the rule engine on a parsed virtual TSX file in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAnchorIsValidAllowsSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", `declare const props: object; const Component = () => <a {...props}>documentation</a>;`)
}
