package linthost

import "testing"

// TestReactDisplayNameReportsAnonymousMemo verifies that an anonymous
// arrow passed directly to `React.memo(...)` — without a surrounding
// named binding — is flagged for missing displayName.
//
// The anonymous arrow and named function expression provide opposite
// AST naming controls for the wrapper policy. The unit does not execute
// React or inspect a runtime component name.
//
// 1. Parse `React.memo(() => <div />)` inside a JSON.stringify argument.
// 2. Enable only `react/display-name`.
// 3. Assert the wrapper call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify anonymous inline React.memo reports missing display name; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A named function supplies component identity for tooling.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactDisplayNameReportsAnonymousMemo is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactDisplayNameReportsAnonymousMemo(t *testing.T) {
  assertReactRuleFinds(t, "react/display-name", `declare const React: { memo: <T>(fn: T) => T };
JSON.stringify(React.memo(() => <div />));`, "display name")
  assertReactRuleSkips(t, "react/display-name", "declare const React: { memo: <T>(fn: T) => T }; JSON.stringify(React.memo(function Named() { return <div />; }));")
}
