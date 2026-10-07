package linthost

import "testing"

// TestReactJSXNoUndefReportsUndeclaredComponent verifies that a JSX
// element whose uppercase tag has no value-level declaration anywhere
// in the source file is flagged.
//
// Lowercase tags are intrinsic HTML and qualified `<Foo.Bar>` tags need
// type-level resolution, so the conservative baseline only fires on a
// bare uppercase identifier with no matching binding.
//
// 1. Parse a component that returns `<Missing />` with no declaration.
// 2. Enable only `react/jsx-no-undef`.
// 3. Assert the missing identifier is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify undeclared Missing JSX identifier reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A value-level declaration binds the component; bare uppercase text alone does not.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoUndefReportsUndeclaredComponent is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXNoUndefReportsUndeclaredComponent(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-undef", `const C = () => <Missing />;
JSON.stringify(C);`, "Missing")
  assertReactRuleSkips(t, "react/jsx-no-undef", "function Missing() { return null; } const C = () => <Missing />; JSON.stringify(C);")
}
