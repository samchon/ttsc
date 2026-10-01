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
//
// @evidence contracts/testing.md#behavioral-verification NewEngineWithResolver.Run via the reactPerf assertion helpers verifies lines 3 through 7 report literal, constructor, call, nullish fallback and conditional arrays; exact finding-line comparison rejects extra or missing diagnostics for react-perf/jsx-no-new-array-as-prop.
// @evidence contracts/testing.md#independent-expectations React element and shallow prop identity semantics establish which inline expressions allocate new values; the literal line list locates those authored expressions without consulting rule output.
// @evidence contracts/testing.md#distinguishing-cases The stable array reference on line 8 remains clean; allocation rather than merely array type changes the result.
// @evidence contracts/testing.md#execution-ownership TestReactPerfJsxNoNewArrayAsProp owns these explicit source/option variants as one Go unit entry; TSX parsing and actual engine execution share the Go test process without installing React or starting a product host.
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
