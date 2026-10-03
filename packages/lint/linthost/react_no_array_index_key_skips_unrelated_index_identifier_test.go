package linthost

import "testing"

// TestReactNoArrayIndexKeySkipsUnrelatedIndexIdentifier verifies unrelated
// `index` variables are not rejected.
//
// The rule targets array map callback index parameters. A plain identifier
// named `index` outside a list callback may be a stable application key.
//
// 1. Parse JSX outside an array map callback using `key={index}`.
// 2. Enable only `react/no-array-index-key`.
// 3. Assert no finding is reported.
//
// @evidence contracts/testing.md#behavioral-verification Actual React rule engine operations verify an application identifier named index outside a map remains clean; complete finding counts/identities, message assertions or authored ranges distinguish the defect owned here.
// @evidence contracts/testing.md#independent-expectations Name spelling alone does not make a key the array callback ordinal.
// @evidence contracts/testing.md#distinguishing-cases A static application key is accepted despite its name; both ordinal spellings have separate reported cases.
// @evidence contracts/testing.md#execution-ownership TestReactNoArrayIndexKeySkipsUnrelatedIndexIdentifier is a named Go unit entry operating on TypeScript/TSX ASTs in the shared engine process without a React installation or product child host.
func TestReactNoArrayIndexKeySkipsUnrelatedIndexIdentifier(t *testing.T) {
  assertReactRuleSkips(t, "react/no-array-index-key", `const index = "id-1"; const node = <li key={index} />;`)
}
