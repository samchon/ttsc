package linthost

import "testing"

// TestJsxA11yAltTextAllowsImgSpreadProps verifies jsx-a11y/alt-text stays quiet
// for an img whose only attribute is a spread.
//
// A `{...props}` spread makes the attribute set unknown at lint time, and the
// alt text may be inside it, so the rule must not guess. This case also guards
// the former crash of the attribute walk on spread members.
//
// 1. Run only `jsx-a11y/alt-text` over `<img {...props} />` in a TSX file.
// 2. Require no finding, which also fails on a recovered rule panic.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleSkips parses the TSX source with parseTSXFile and runs NewEngine.Run with only jsx-a11y/alt-text enabled at error severity. The Test requires zero findings for the spread-only img, so a missing-alt report and an engine-failure finding produced by a recovered panic would both fail it.
// @evidence contracts/testing.md#independent-expectations Because the missing-attribute check is conservative, alt may arrive through an unknown spread. The authored source and the zero expectation follow from that policy rather than from sampling rule output.
// @evidence contracts/testing.md#distinguishing-cases The Test is the spread-accepted case. TestJsxA11yAltTextRequiresImgAlt reports an img with a known set of attributes that lacks alt and accepts one with alt.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleSkips call, executing the rule engine on a parsed virtual TSX file in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAltTextAllowsImgSpreadProps(t *testing.T) {
  assertJsxA11yRuleSkips(t, "jsx-a11y/alt-text", `declare const props: object; const Component = () => <img {...props} />;`)
}
