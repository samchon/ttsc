package linthost

import "testing"

// TestReactNoArrayIndexKeyReportsIndexKey verifies index keys are rejected.
//
// `key={index}` is a known reconciliation footgun and can be caught from the
// JSX attribute expression alone.
//
// 1. Parse a JSX element with key={index}.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert the key prop is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify the map callback index used as a key reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations The callback ordinal changes with array order; an item identity is the accepted key.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoArrayIndexKeyReportsIndexKey is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoArrayIndexKeyReportsIndexKey(t *testing.T) {
  assertReactRuleFinds(t, "react/no-array-index-key", `const C = ({ items }: { items: string[] }) => items.map((item, index) => <li key={index}>{item}</li>);`, "index")
  assertReactRuleSkips(t, "react/no-array-index-key", "const C = ({ items }: { items: string[] }) => items.map((item, index) => <li key={item}>{item}</li>);")
}
