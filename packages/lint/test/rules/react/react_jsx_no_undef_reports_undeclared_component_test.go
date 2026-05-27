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
func TestReactJSXNoUndefReportsUndeclaredComponent(t *testing.T) {
	assertReactRuleFinds(t, "react/jsx-no-undef", `const C = () => <Missing />;
JSON.stringify(C);`, "Missing")
}
