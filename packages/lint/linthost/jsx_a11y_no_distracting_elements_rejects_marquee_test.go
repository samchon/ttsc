package linthost

import "testing"

// TestJsxA11yNoDistractingElementsRejectsMarquee verifies distracting tags are rejected.
//
// Legacy animated elements are intrinsic tags, so this rule should diagnose them
// without attribute or child inspection.
//
// 1. Parse a marquee element.
// 2. Enable only `jsx-a11y/no-distracting-elements`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify marquee is a distracting intrinsic tag; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A normal static div preserves content without forced animation. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The marquee carrying Sale reports; a div with the same content is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoDistractingElementsRejectsMarquee owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoDistractingElementsRejectsMarquee(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-distracting-elements", `const Component = () => <marquee>Sale</marquee>;`, "distracting")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-distracting-elements", "declare const props: object; const Component = () => <div>Sale</div>;")
}
