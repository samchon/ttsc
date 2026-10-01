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
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify a fragment around a single JSX child reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Two siblings require grouping whereas a single element does not.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXNoUselessFragmentReportsSingleChildWrap is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXNoUselessFragmentReportsSingleChildWrap(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-no-useless-fragment", `declare const Child: () => JSX.Element;
const C = () => (
  <>
    <Child />
  </>
);
JSON.stringify(C);`, "Fragment wraps a single element")
  assertReactRuleSkips(t, "react/jsx-no-useless-fragment", "const C = () => <><div /><span /></>; JSON.stringify(C);")
}
