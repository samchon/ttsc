package linthost

import "testing"

// TestReactPerfJsxNoJsxAsProp verifies JSX values created inside JSX props are rejected.
//
// Passing freshly-created JSX as a prop creates a new React element object on
// every render. This case covers element, fragment, fallback, and conditional
// forms without treating a precomputed JSX reference as a violation.
//
// 1. Parse TSX with JSX element values inside JSX props.
// 2. Enable `react-perf/jsx-no-jsx-as-prop`.
// 3. Assert only freshly-created JSX prop values are reported.
func TestReactPerfJsxNoJsxAsProp(t *testing.T) {
	source := "const stable = <SubItem />;\n" +
		"const view = <>\n" +
		"  <Item jsx={<SubItem />} />\n" +
		"  <Item jsx={<><SubItem /></>} />\n" +
		"  <Item jsx={props.jsx || <SubItem />} />\n" +
		"  <Item jsx={props.jsx ? props.jsx : <SubItem />} />\n" +
		"  <Item jsx={stable} />\n" +
		"</>;\n"
	reactPerfAssertLines(t, "react-perf/jsx-no-jsx-as-prop", source, []int{3, 4, 5, 6})
}
