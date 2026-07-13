package linthost

import "testing"

// TestNoUnsafeAssignmentDestructuringReassignment covers array and object
// patterns represented as literal expressions on the left of `=`.
//
// 1. Reassign from tuple and object sources whose selected leaves are `any`.
// 2. Repeat both shapes with `unknown` leaves as safe twins.
// 3. Require one finding for each unsafe selected leaf and no contextual duplicates.
func TestNoUnsafeAssignmentDestructuringReassignment(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const tuple: [any];
declare const safeTuple: [unknown];
declare const object: { value: any };
declare const safeObject: { value: unknown };
let arrayValue: unknown;
let objectValue: unknown;

// expect: typescript/no-unsafe-assignment error
[arrayValue] = tuple;
[arrayValue] = safeTuple;
// expect: typescript/no-unsafe-assignment error
({ value: objectValue } = object);
({ value: objectValue } = safeObject);

void [arrayValue, objectValue];
`)
}
