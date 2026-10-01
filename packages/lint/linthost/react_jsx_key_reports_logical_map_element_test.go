package linthost

import "testing"

// TestReactJSXKeyReportsLogicalMapElement verifies logical list branches need
// keys.
//
// Conditional rendering with `&&` is a common map callback shape. The rule
// should report the JSX branch because React still receives it as the mapped
// item when the condition is true.
//
// 1. Parse a map callback returning `condition && <li />`.
// 2. Enable only `react/jsx-key`.
// 3. Assert the unkeyed logical branch element is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify unkeyed logical map branch reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations A conditionally returned JSX list item still needs a key.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactJSXKeyReportsLogicalMapElement is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactJSXKeyReportsLogicalMapElement(t *testing.T) {
  assertReactRuleFinds(t, "react/jsx-key", `const C = ({ items }: { items: string[] }) => items.map((item) => item && <li>{item}</li>);`, "key")
  assertReactRuleSkips(t, "react/jsx-key", "const C = ({ items }: { items: string[] }) => items.map(item => item && <li key={item}>{item}</li>);")
}
