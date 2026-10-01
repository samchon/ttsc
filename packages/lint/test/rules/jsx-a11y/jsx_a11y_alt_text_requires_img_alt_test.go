package linthost

import "testing"

// TestJsxA11yAltTextRequiresImgAlt verifies jsx-a11y/alt-text reports an img
// without a text alternative and accepts one with alt.
//
// This is the intrinsic-element branch of the rule, which reads JSX attributes
// without any React component metadata.
//
// 1. Run only `jsx-a11y/alt-text` over `<img src="avatar.png" />` and expect
//    one finding whose message contains "alt text".
// 2. Run it over the same img with `alt="Profile"` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/alt-text enabled. The img without alt yields exactly one ordinary SeverityError finding from that rule whose message contains "alt text"; assertJsxA11yRuleSkips requires zero findings for the img with alt="Profile".
// @evidence contracts/testing.md#independent-expectations An image needs a text alternative, and an explicit alt string provides one. The two literal sources and the "alt text" message fragment are authored from that accessibility policy.
// @evidence contracts/testing.md#distinguishing-cases The two sources are the same avatar img with and without the alt attribute. The alternatives alt can be replaced by (aria-label, aria-labelledby) and the spread case are not exercised here; the spread case belongs to TestJsxA11yAltTextAllowsImgSpreadProps.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAltTextRequiresImgAlt(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/alt-text", `const Component = () => <img src="avatar.png" />;`, "alt text")
  assertJsxA11yRuleSkips(t, "jsx-a11y/alt-text", "declare const props: object; const Component = () => <img src=\"avatar.png\" alt=\"Profile\" />;")
}
