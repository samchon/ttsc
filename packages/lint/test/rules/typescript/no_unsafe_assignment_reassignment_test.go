package linthost

import "testing"

// TestNoUnsafeAssignmentReassignment covers established receiver types on
// plain assignment expressions.
//
// 1. Reassign `any` into string and `unknown` bindings.
// 2. Reassign a string into a second string binding as the safe twin.
// 3. Require only the concrete receiver to report.
func TestNoUnsafeAssignmentReassignment(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;
let concrete = "value";
let boundary: unknown;
let safe = "before";

// expect: typescript/no-unsafe-assignment error
concrete = leaked;
boundary = leaked;
safe = "after";

void [concrete, boundary, safe];
`)
}
