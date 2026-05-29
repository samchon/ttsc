package linthost

import "testing"

// TestJsxA11yAnchorAmbiguousTextRejectsClickHere verifies anchors whose
// visible text is one of the ambiguous-phrase blacklist surface as a
// diagnostic.
//
// Screen-reader users navigate by listing links; "click here" / "more"
// / "read more" become indistinguishable noise on that list. The rule
// catches the most common offenders before they ship.
//
// 1. Parse an anchor whose only child is the ambiguous text "click here".
// 2. Enable only `jsx-a11y/anchor-ambiguous-text`.
// 3. Assert one diagnostic is reported.
func TestJsxA11yAnchorAmbiguousTextRejectsClickHere(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-ambiguous-text", `const Component = () => <a href="/docs">click here</a>;`, "ambiguous")
}
