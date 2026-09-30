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
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify anchor text is click here; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Descriptive link text identifies its destination in assistive navigation. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The click here label reports; Documentation with the same /docs href is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAnchorAmbiguousTextRejectsClickHere owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAnchorAmbiguousTextRejectsClickHere(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-ambiguous-text", `const Component = () => <a href="/docs">click here</a>;`, "ambiguous")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-ambiguous-text", "declare const props: object; const Component = () => <a href=\"/docs\">Documentation</a>;")
}
