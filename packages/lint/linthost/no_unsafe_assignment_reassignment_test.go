package linthost

import "testing"

// TestNoUnsafeAssignmentReassignment covers established receiver types on
// plain assignment expressions.
//
// 1. Reassign `any` into string and `unknown` bindings.
// 2. Reassign a string into a second string binding as the safe twin.
// 3. Require only the concrete receiver to report.
// @evidence contracts/testing.md#behavioral-verification Plain assignment must use the established receiver type.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored any-to-string reassignment finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown receiver and string-to-string reassignment stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentReassignment invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
