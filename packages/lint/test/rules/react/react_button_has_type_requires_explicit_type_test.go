package linthost

import "testing"

// TestReactButtonHasTypeRequiresExplicitType verifies React button elements
// declare a safe type.
//
// Buttons default to submit in forms, so missing or invalid type attributes are
// a high-confidence TSX issue that does not need React runtime analysis.
//
// 1. Parse a JSX button without a type prop.
// 2. Enable only `react/button-has-type`.
// 3. Assert one diagnostic is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify button without type reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations HTML buttons default to submit; explicit button type removes that accidental submission behavior.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactButtonHasTypeRequiresExplicitType is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactButtonHasTypeRequiresExplicitType(t *testing.T) {
  assertReactRuleFinds(t, "react/button-has-type", `const C = () => <button>Save</button>;`, "button")
  assertReactRuleSkips(t, "react/button-has-type", "const C = () => <button type=\"button\">Save</button>;")
}
