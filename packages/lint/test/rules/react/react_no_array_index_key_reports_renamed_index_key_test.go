package linthost

import "testing"

// TestReactNoArrayIndexKeyReportsRenamedIndexKey verifies renamed index
// parameters are rejected.
//
// Teams often name the second map callback parameter `idx` or `i`; the rule
// should follow the actual parameter binding instead of only the literal word
// `index`.
//
// 1. Parse a map callback with `idx` as the second parameter.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert `key={idx}` is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify renamed idx callback index used as a key reports; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Parameter binding, not the spelling index, determines the ordinal; stable item keys remain accepted.
// @evidence contracts/testing.md#distinguishing-cases The original reported input remains intact and the adjacent accepted source produces zero findings.
// @evidence contracts/testing.md#execution-ownership TestReactNoArrayIndexKeyReportsRenamedIndexKey is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoArrayIndexKeyReportsRenamedIndexKey(t *testing.T) {
  assertReactRuleFinds(t, "react/no-array-index-key", `const C = ({ items }: { items: string[] }) => items.map((item, idx) => <li key={idx}>{item}</li>);`, "index")
  assertReactRuleSkips(t, "react/no-array-index-key", "const C = ({ items }: { items: string[] }) => items.map((item, idx) => <li key={item}>{item}</li>);")
}
