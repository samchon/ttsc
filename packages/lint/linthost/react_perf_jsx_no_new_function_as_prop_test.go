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
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.Run via the reactPerf assertion helpers verifies lines 3 through 8 report function expressions, arrows, Function construction/calls and fallback/conditional callbacks; exact finding-line comparison rejects extra or missing diagnostics for react-perf/jsx-no-new-function-as-prop.
// @evidence contracts/testing.md#independent-expectations React element and shallow prop identity semantics establish which inline expressions allocate new values; the literal line list locates those authored expressions without consulting rule output.
// @evidence contracts/testing.md#distinguishing-cases The stable callback reference on line 9 remains clean; referring to an existing function does not allocate a fresh callback.
// @evidence contracts/testing.md#execution-ownership TestReactPerfJsxNoNewFunctionAsProp owns these authored TSX expressions under default rule options as one Go unit entry; TSX parsing and actual engine execution share the Go test process without installing React or starting a product host.
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
