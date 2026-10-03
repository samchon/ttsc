package linthost

import "testing"

// TestJsxA11yImgRedundantAltRejectsImageWordDespiteSpread verifies spreads do
// not suppress explicit redundant alt text.
//
// img-redundant-alt judges an explicitly written alt value, so a sibling
// spread does not suppress this static report. The case pins this rule's
// known-alt policy, not every rule's spread handling or the final runtime
// alt value after a spread. The attribute walk must not panic on the
// JsxSpreadAttribute member.
//
// 1. Parse an img with a redundant alt plus a spread.
// 2. Enable only `jsx-a11y/img-redundant-alt`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify photo wording redundantly repeats the image role beside a spread; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations An explicit descriptive alt avoids repeated role wording with the same unknown props. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The photo of me alternative reports despite a spread; Profile with the same spread is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yImgRedundantAltRejectsImageWordDespiteSpread owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yImgRedundantAltRejectsImageWordDespiteSpread(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/img-redundant-alt", `declare const props: object; const Component = () => <img alt="photo of me" {...props} />;`, "redundant")
  assertJsxA11yRuleSkips(t, "jsx-a11y/img-redundant-alt", "declare const props: object; const Component = () => <img alt=\"Profile\" {...props} />;")
}
