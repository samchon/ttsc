package linthost

import "testing"

// TestNoUnsafeAssignmentArrayDestructuring covers direct `any`, `any[]`, and
// tuple leaves without duplicate reports.
//
// 1. Destructure direct `any`, an `any[]`, and a tuple with two `any` leaves.
// 2. Destructure a tuple of `unknown` and string as the safe twin.
// 3. Require one boundary finding for the first two and one per unsafe tuple leaf.
//
// @evidence contracts/testing.md#behavioral-verification Destructuring must expose direct any, any-array and tuple-leaf escapes without duplicate contextual findings.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require four authored findings, including two on the tuple destructuring line; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown/string tuple leaves remain clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentArrayDestructuring invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentArrayDestructuring(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const direct: any;
declare const array: any[];
declare const tuple: [any, string, any];
declare const safeTuple: [unknown, string];

// expect: typescript/no-unsafe-assignment error
const [fromDirect] = direct;
// expect: typescript/no-unsafe-assignment error
const [fromArray] = array;
// expect: typescript/no-unsafe-assignment error
// expect: typescript/no-unsafe-assignment error
const [first, middle, last] = tuple;
const [boundary, safe] = safeTuple;

void [fromDirect, fromArray, first, middle, last, boundary, safe];
`)
}
