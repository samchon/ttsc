package linthost

import "testing"

// TestReactNoArrayIndexKeySkipsNestedNonListElement verifies nested JSX is not
// treated as the mapped item.
//
// A child element inside the returned list item may receive its own stable key
// for a separate reason. The rule should follow the same list-item boundary as
// `react/jsx-key`.
//
// 1. Parse a map callback returning a keyed wrapper with a nested keyed child.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert the nested `key={index}` is not reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify a nested child index key remains clean under a stable keyed list wrapper; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations The nested child is not the map callback list item governed by this rule.
// @evidence contracts/testing.md#distinguishing-cases The wrapper and nested child have different key ownership; actual mapped ordinal keys have separate reported cases.
// @evidence contracts/testing.md#execution-ownership TestReactNoArrayIndexKeySkipsNestedNonListElement is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoArrayIndexKeySkipsNestedNonListElement(t *testing.T) {
  assertReactRuleSkips(t, "react/no-array-index-key", `const C = ({ items }: { items: string[] }) => items.map((item, index) => <li key={item}><span key={index}>{item}</span></li>);`)
}
