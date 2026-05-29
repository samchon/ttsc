package linthost

import "testing"

// TestReactJSXNoUselessFragmentReportsSingleChildWrap verifies that a
// fragment wrapping exactly one JSX element is flagged.
//
// A fragment with a single element child adds nothing — the caller can
// return the child directly. This pins the single-child branch of
// `checkReactJSXNoUselessFragment`.
//
// 1. Parse a short fragment `<><Child /></>` returned from a component.
// 2. Enable only `react/jsx-no-useless-fragment`.
// 3. Assert the fragment is reported.
func TestReactJSXNoUselessFragmentReportsSingleChildWrap(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-useless-fragment", `declare const Child: () => JSX.Element;
const C = () => (
  <>
    <Child />
  </>
);
JSON.stringify(C);`, "Fragment wraps a single element")
}
