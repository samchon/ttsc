package linthost

import "testing"

// TestJsxA11yIframeHasTitleRequiresTitle verifies iframe titles are required.
//
// Iframes need a non-empty title for assistive technology. This test covers the
// self-closing JSX branch.
//
// 1. Parse an iframe without title.
// 2. Enable only `jsx-a11y/iframe-has-title`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify iframe omits title; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations A title labels the embedded content. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The /embed iframe without title reports; adding title="Content" is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yIframeHasTitleRequiresTitle owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yIframeHasTitleRequiresTitle(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/iframe-has-title", `const Component = () => <iframe src="/embed" />;`, "title")
  assertJsxA11yRuleSkips(t, "jsx-a11y/iframe-has-title", "declare const props: object; const Component = () => <iframe src=\"/embed\" title=\"Content\" />;")
}
