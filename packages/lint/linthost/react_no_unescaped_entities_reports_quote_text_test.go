package linthost

import "testing"

// TestReactNoUnescapedEntitiesReportsQuoteText verifies unescaped JSX text.
//
// The rule flags raw quote-like characters in text nodes without inspecting
// expressions or generated strings.
//
// 1. Parse JSX text containing an apostrophe.
// 2. Enable only `react/no-unescaped-entities`.
// 3. Assert the text node is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify an apostrophe in JSX text reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations An escaped entity preserves the intended visible apostrophe without the unescaped syntax.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoUnescapedEntitiesReportsQuoteText is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoUnescapedEntitiesReportsQuoteText(t *testing.T) {
  assertReactRuleFinds(t, "react/no-unescaped-entities", `const C = () => <div>Tom's profile</div>;`, "Unescaped")
  assertReactRuleSkips(t, "react/no-unescaped-entities", "const C = () => <div>Tom&apos;s profile</div>;")
}
