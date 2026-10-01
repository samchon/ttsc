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
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.Run via the reactPerf assertion helpers verifies lines 3 through 6 report freshly constructed element, fragment, fallback and conditional JSX values; exact finding-line comparison rejects extra or missing diagnostics for react-perf/jsx-no-jsx-as-prop.
// @evidence contracts/testing.md#independent-expectations React element and shallow prop identity semantics establish which inline expressions allocate new values; the literal line list locates those authored expressions without consulting rule output.
// @evidence contracts/testing.md#distinguishing-cases The precomputed stable element on line 7 remains clean; object identity is allocated only in the reported prop expressions.
// @evidence contracts/testing.md#execution-ownership TestReactPerfJsxNoJsxAsProp owns these explicit source/option variants as one Go unit entry; TSX parsing and actual engine execution share the Go test process without installing React or starting a product host.
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
