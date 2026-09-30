package linthost

import "testing"

// TestReactJSXKeyReportsConditionalMapElement verifies conditional list
// branches need keys.
//
// Map callbacks often return ternaries instead of a JSX element directly. The
// rule must still treat each JSX branch as the list item while not walking into
// nested JSX children.
//
// 1. Parse a map callback returning a ternary with JSX branches.
// 2. Enable only `react/jsx-key`.
// 3. Assert the unkeyed branch element is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify only the unkeyed ternary list branch reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Each returned list branch needs its own key; the keyed li is already a clean counterpart.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXKeyReportsConditionalMapElement is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXKeyReportsConditionalMapElement(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-key", `const C = ({ items }: { items: string[] }) => items.map((item) => item ? <li key={item}>{item}</li> : <span>{item}</span>);`, "key")
  assertReactRuleSkips(t, "react/jsx-key", "const C = ({ items }: { items: string[] }) => items.map(item => item ? <li key={item}>{item}</li> : <span key={item}>{item}</span>);")
}
