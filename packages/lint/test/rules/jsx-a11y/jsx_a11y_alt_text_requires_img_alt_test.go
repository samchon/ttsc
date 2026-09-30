package linthost

import "testing"

// TestJsxA11yAltTextRequiresImgAlt verifies img elements need text alternatives.
//
// This pins the TSX intrinsic-element branch for `jsx-a11y/alt-text`, where the
// lint engine must read JSX attributes without relying on React component metadata.
//
// 1. Parse an img without alt or ARIA labeling attributes.
// 2. Enable only `jsx-a11y/alt-text`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify img has no text alternative; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations An explicit alt string supplies the image alternative. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases An img without alt is reported; adding alt="Profile" to the same avatar source is clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yAltTextRequiresImgAlt owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yAltTextRequiresImgAlt(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/alt-text", `const Component = () => <img src="avatar.png" />;`, "alt text")
  assertJsxA11yRuleSkips(t, "jsx-a11y/alt-text", "declare const props: object; const Component = () => <img src=\"avatar.png\" alt=\"Profile\" />;")
}
