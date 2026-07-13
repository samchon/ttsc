package linthost

import "testing"

// TestNoUnsafeAssignmentArrayDestructuring covers direct `any`, `any[]`, and
// tuple leaves without duplicate reports.
//
// 1. Destructure direct `any`, an `any[]`, and a tuple with two `any` leaves.
// 2. Destructure a tuple of `unknown` and string as the safe twin.
// 3. Require one boundary finding for the first two and one per unsafe tuple leaf.
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
