package linthost

import "testing"

// TestJsxA11yAnchorIsValidRejectsHashHref verifies placeholder hrefs are rejected.
//
// The native rule intentionally handles the high-confidence invalid targets that
// do not require router or component settings: empty, hash-only, and javascript URLs.
//
// 1. Parse an anchor whose href is `#`.
// 2. Enable only `jsx-a11y/anchor-is-valid`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify hash-only href is not a navigation target; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A real relative path supplies a valid target. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The hash destination reports; /home with the same Home label is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAnchorIsValidRejectsHashHref owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAnchorIsValidRejectsHashHref(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/anchor-is-valid", `const Component = () => <a href="#">Home</a>;`, "href")
  assertJsxA11yRuleSkips(t, "jsx-a11y/anchor-is-valid", "declare const props: object; const Component = () => <a href=\"/home\">Home</a>;")
}
