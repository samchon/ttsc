package linthost

import "testing"

// TestDefaultCaseAcceptsExistingDefaultClause verifies a present default clause satisfies the rule.
//
// A `switch` that already spells out `default` needs no marker and must never
// report. Negative twin of the missing-default finding, one property away (the
// default clause added).
//
// 1. Build a switch whose clauses include a `default`.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
func TestDefaultCaseAcceptsExistingDefaultClause(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  default:
    console.log("other");
}
`, "")
}
