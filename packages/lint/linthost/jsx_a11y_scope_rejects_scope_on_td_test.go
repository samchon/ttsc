package linthost

import "testing"

// TestJsxA11yScopeRejectsScopeOnTd verifies scope is only accepted on th.
//
// Table scope only describes header cells. This case catches the common td
// spelling error through intrinsic tag inspection.
//
// 1. Parse a td with scope.
// 2. Enable only `jsx-a11y/scope`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual TSX parsing and NewEngine.Run verify td carries a header-only scope attribute; reported variants require one ordinary SeverityError finding from the named rule with the authored message fragment, and clean variants require zero findings.
// @evidence contracts/testing.md#independent-expectations The th element owns column/header scope. The source inputs and literal expected findings follow this supported accessibility policy without sampling implementation output.
// @evidence contracts/testing.md#distinguishing-cases scope="col" on td reports; the same scope and Value content on th are clean.
// @evidence contracts/testing.md#execution-ownership TestJsxA11yScopeRejectsScopeOnTd owns these explicit AST variants as a named Go unit entry; the owning engine executes in the shared test process without a browser, accessibility runtime installation or product child host.
func TestJsxA11yScopeRejectsScopeOnTd(t *testing.T) {
  assertJsxA11yRuleFinds(t, "jsx-a11y/scope", `const Component = () => <td scope="col">Value</td>;`, "scope")
  assertJsxA11yRuleSkips(t, "jsx-a11y/scope", "declare const props: object; const Component = () => <th scope=\"col\">Value</th>;")
}
