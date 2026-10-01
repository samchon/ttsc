package linthost

import "testing"

// TestNoUnsafeAssignmentDestructuringReassignment covers array and object
// patterns represented as literal expressions on the left of `=`.
//
// 1. Reassign from tuple and object sources whose selected leaves are `any`.
// 2. Repeat both shapes with `unknown` leaves as safe twins.
// 3. Require one finding for each unsafe selected leaf and no contextual duplicates.
// @evidence contracts/testing.md#behavioral-verification Destructuring reassignment must inspect selected leaf types without contextual duplicates.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one array and one object selected-leaf finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown leaf twins remain clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentDestructuringReassignment invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
