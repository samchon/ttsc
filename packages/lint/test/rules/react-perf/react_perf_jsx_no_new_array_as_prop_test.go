package linthost

import "testing"

// TestReactPerfJsxNoNewArrayAsProp verifies array values created inside JSX props are rejected.
//
// Inline arrays create a new reference on each render and commonly invalidate
// memoized React child components. This case covers literal, constructor, call,
// fallback, and conditional forms while allowing stable references.
//
// 1. Parse TSX with freshly-created array prop values.
// 2. Enable `react-perf/jsx-no-new-array-as-prop`.
// 3. Assert only the newly-created array values are reported.
func TestReactPerfJsxNoNewArrayAsProp(t *testing.T) {
	source := "const stable: string[] = [];\n" +
		"const view = <>\n" +
		"  <Item list={[]} />\n" +
		"  <Item list={new Array()} />\n" +
		"  <Item list={Array()} />\n" +
		"  <Item list={props.list ?? []} />\n" +
		"  <Item list={props.list ? props.list : []} />\n" +
		"  <Item list={stable} />\n" +
		"</>;\n"
	reactPerfAssertLines(t, "react-perf/jsx-no-new-array-as-prop", source, []int{3, 4, 5, 6, 7})
}
