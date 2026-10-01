package linthost

import "testing"

// TestJsxA11yHeadingHasContentRejectsEmptyHeading verifies headings need content.
//
// Both normal empty headings and self-closing headings omit child text. The
// rule must visit both JSX node kinds for intrinsic heading tags.
//
// 1. Parse normal and self-closing empty h2 elements.
// 2. Enable only `jsx-a11y/heading-has-content`.
// 3. Assert each empty heading reports a diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify normal and self-closing h2 have no content; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Text content gives the heading its accessible name. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases Both empty paired and self-closing h2 shapes report; adding Title content is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yHeadingHasContentRejectsEmptyHeading owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yHeadingHasContentRejectsEmptyHeading(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/heading-has-content", `const Component = () => <h2></h2>;`, "Headings")
  assertJsxA11yRuleFinds(t, "jsx-a11y/heading-has-content", `const Component = () => <h2 />;`, "Headings")
  assertJsxA11yRuleSkips(t, "jsx-a11y/heading-has-content", "declare const props: object; const Component = () => <h2>Title</h2>;")
}
