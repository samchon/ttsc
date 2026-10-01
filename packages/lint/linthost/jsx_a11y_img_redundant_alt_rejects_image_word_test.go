package linthost

import "testing"

// TestJsxA11yImgRedundantAltRejectsImageWord verifies redundant image wording is rejected.
//
// Screen readers already announce image roles, so this rule inspects literal alt
// text for repeated words such as image, photo, or picture.
//
// 1. Parse an img whose alt text starts with "image".
// 2. Enable only `jsx-a11y/img-redundant-alt`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify image wording redundantly repeats the image role; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations Describing the subject without image/photo wording avoids the redundancy. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The image of profile alternative reports; the nonredundant Profile alternative is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yImgRedundantAltRejectsImageWord owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yImgRedundantAltRejectsImageWord(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/img-redundant-alt", `const Component = () => <img alt="image of profile" />;`, "redundant")
  assertJsxA11yRuleSkips(t, "jsx-a11y/img-redundant-alt", "declare const props: object; const Component = () => <img alt=\"Profile\" />;")
}
