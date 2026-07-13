package linthost

import "testing"

// TestNoUnsafeAssignmentArraySpreads covers direct `any` and `any[]` spread
// operands without flagging typed arrays.
//
// 1. Spread direct `any`, `any[]`, and `string[]` into array literals.
// 2. Keep the typed spread as the negative twin.
// 3. Require one finding for each unsafe spread operand.
func TestNoUnsafeAssignmentArraySpreads(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const leaked: any;
declare const unsafeArray: any[];
declare const safeArray: string[];

// expect: typescript/no-unsafe-assignment error
const direct = [...leaked];
// expect: typescript/no-unsafe-assignment error
const array = [...unsafeArray];
const safe = [...safeArray];

void [direct, array, safe];
`)
}
