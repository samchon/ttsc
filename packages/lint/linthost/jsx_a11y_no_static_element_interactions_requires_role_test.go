package linthost

import "testing"

// TestJsxA11yNoStaticElementInteractionsRequiresRole verifies static elements with handlers need roles.
//
// A div with an activation handler has no native control semantics. This rule
// asks for an explicit role when static markup becomes interactive.
//
// 1. Parse a div with onClick and no role.
// 2. Enable only `jsx-a11y/no-static-element-interactions`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify clickable static div has no interactive role; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations An explicit button role satisfies this static role requirement; the role alone does not add keyboard activation. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases The onClick div without role reports; adding button role while retaining its handler is clean for this rule.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yNoStaticElementInteractionsRequiresRole owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yNoStaticElementInteractionsRequiresRole(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/no-static-element-interactions", `const Component = () => <div onClick={() => {}} />;`, "Static")
  assertJsxA11yRuleSkips(t, "jsx-a11y/no-static-element-interactions", "declare const props: object; const Component = () => <div role=\"button\" onClick={() => {}} />;")
}
