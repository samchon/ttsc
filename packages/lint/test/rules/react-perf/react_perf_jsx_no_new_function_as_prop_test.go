package linthost

import "testing"

// TestReactPerfJsxNoNewFunctionAsProp verifies function values created inside JSX props are rejected.
//
// Inline callbacks are the most common React prop identity footgun: they allocate
// on every render and make memoized children appear changed. This pins function
// expressions, arrow functions, `Function` constructor calls, and fallback forms.
//
// 1. Parse TSX with freshly-created function prop values.
// 2. Enable `react-perf/jsx-no-new-function-as-prop`.
// 3. Assert stable callback references are left alone.
func TestReactPerfJsxNoNewFunctionAsProp(t *testing.T) {
	source := "const stable = () => undefined;\n" +
		"const view = <>\n" +
		"  <Item callback={function () {}} />\n" +
		"  <Item callback={() => undefined} />\n" +
		"  <Item callback={new Function(\"return 1\")} />\n" +
		"  <Item callback={Function(\"return 1\")} />\n" +
		"  <Item callback={props.callback || function () {}} />\n" +
		"  <Item callback={props.callback ? props.callback : () => undefined} />\n" +
		"  <Item callback={stable} />\n" +
		"</>;\n"
	reactPerfAssertLines(t, "react-perf/jsx-no-new-function-as-prop", source, []int{3, 4, 5, 6, 7, 8})
}
