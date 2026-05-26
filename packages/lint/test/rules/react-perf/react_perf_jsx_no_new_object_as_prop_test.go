package linthost

import "testing"

// TestReactPerfJsxNoNewObjectAsProp verifies object values created inside JSX props are rejected.
//
// Fresh object literals and `Object` constructor calls allocate a new reference on
// every render, defeating shallow prop equality in memoized React components. This
// pins the high-confidence TSX shapes from eslint-plugin-react-perf without needing
// runtime React semantics.
//
// 1. Parse TSX with direct, fallback, and conditional object prop values.
// 2. Enable `react-perf/jsx-no-new-object-as-prop`.
// 3. Assert each newly-created object value is reported.
func TestReactPerfJsxNoNewObjectAsProp(t *testing.T) {
	source := "const stable = {};\n" +
		"const view = <>\n" +
		"  <Item config={{}} />\n" +
		"  <Item config={new Object()} />\n" +
		"  <Item config={Object()} />\n" +
		"  <Item config={props.config || {}} />\n" +
		"  <Item config={props.config ? props.config : {}} />\n" +
		"  <Item config={stable} />\n" +
		"</>;\n"
	reactPerfAssertLines(t, "react-perf/jsx-no-new-object-as-prop", source, []int{3, 4, 5, 6, 7})
}
