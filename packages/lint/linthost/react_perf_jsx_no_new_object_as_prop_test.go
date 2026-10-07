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
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.Run via the reactPerf assertion helpers verifies lines 3 through 7 report literal, Object constructor/call and fallback/conditional objects; exact finding-line comparison rejects extra or missing diagnostics for react-perf/jsx-no-new-object-as-prop.
// @evidence contracts/testing.md#independent-expectations React element and shallow prop identity semantics establish which inline expressions allocate new values; the literal line list locates those authored expressions without consulting rule output.
// @evidence contracts/testing.md#distinguishing-cases The stable object reference on line 8 remains clean; allocation inside the prop differs from reuse of an existing object.
// @evidence contracts/testing.md#execution-ownership TestReactPerfJsxNoNewObjectAsProp owns these authored TSX expressions under default rule options as one Go unit entry; TSX parsing and actual engine execution share the Go test process without installing React or starting a product host.
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
