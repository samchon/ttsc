package linthost

import "testing"

// TestReactNoStringRefsReportsStringRef verifies string refs are rejected.
//
// String refs are legacy React API and the literal prop is trivial to detect.
//
// 1. Parse an input with ref="name".
// 2. Enable only `react/no-string-refs`.
// 3. Assert the ref prop is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify a string ref prop reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A callback ref supplies the supported binding without legacy string lookup.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoStringRefsReportsStringRef is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoStringRefsReportsStringRef(t *testing.T) {
  assertReactRuleFinds(t, "react/no-string-refs", `const C = () => <input ref="name" />;`, "String refs")
  assertReactRuleSkips(t, "react/no-string-refs", "const C = () => <input ref={node => {}} />;")
}
