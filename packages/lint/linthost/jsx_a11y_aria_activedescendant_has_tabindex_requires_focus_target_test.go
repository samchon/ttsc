package linthost

import "testing"

// TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget verifies
// jsx-a11y/aria-activedescendant-has-tabindex reports an element that sets
// aria-activedescendant without tabIndex and accepts one with tabIndex.
//
// aria-activedescendant only works from a focused container, so the rule ties
// the attribute to a sibling tabIndex on the same tag.
//
//  1. Run only the rule over `<div aria-activedescendant="item-1" />` and
//     expect one finding whose message contains "tabIndex".
//  2. Run it over the same div with `tabIndex={0}` and expect none.
//
// @evidence contracts/testing.md#behavioral-verification assertJsxA11yRuleFinds parses the TSX source and runs NewEngine.Run with only jsx-a11y/aria-activedescendant-has-tabindex enabled. The div without tabIndex yields exactly one ordinary SeverityError finding from that rule whose message contains "tabIndex"; assertJsxA11yRuleSkips requires zero findings for the div with tabIndex={0}.
// @evidence contracts/testing.md#independent-expectations A tabIndex of zero makes the controlling container focusable, which is what aria-activedescendant requires. The two literal sources and the "tabIndex" fragment are authored from that policy.
// @evidence contracts/testing.md#distinguishing-cases The two sources are the same div with and without tabIndex={0}. A negative tabIndex, a lowercase tabindex attribute and spread attributes are not exercised by this Test.
// @evidence contracts/testing.md#execution-ownership The Test is one Go unit with one assertJsxA11yRuleFinds and one assertJsxA11yRuleSkips call, executing the rule engine on parsed virtual TSX files in the test process with no browser, accessibility runtime or product host.
func TestJsxA11yAriaActivedescendantHasTabindexRequiresFocusTarget(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/aria-activedescendant-has-tabindex", `const Component = () => <div aria-activedescendant="item-1" />;`, "tabIndex")
  assertJsxA11yRuleSkips(t, "jsx-a11y/aria-activedescendant-has-tabindex", "declare const props: object; const Component = () => <div aria-activedescendant=\"item-1\" tabIndex={0} />;")
}
