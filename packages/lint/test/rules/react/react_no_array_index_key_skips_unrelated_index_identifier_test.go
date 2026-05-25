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
func TestReactNoArrayIndexKeySkipsUnrelatedIndexIdentifier(t *testing.T) {
	assertReactRuleSkips(t, "react/no-array-index-key", `const index = "id-1"; const node = <li key={index} />;`)
}
