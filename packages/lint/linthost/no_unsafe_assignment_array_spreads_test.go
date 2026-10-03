package linthost

import "testing"

// TestNoUnsafeAssignmentArraySpreads covers direct `any` and `any[]` spread
// operands without flagging typed arrays.
//
// 1. Spread direct `any`, `any[]`, and `string[]` into array literals.
// 2. Keep the typed spread as the negative twin.
// 3. Require one finding for each unsafe spread operand.
//
// @evidence contracts/testing.md#behavioral-verification Array spreads must inspect unsafe operand element types.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require two authored direct-any and any-array spread findings; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases string-array spread stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentArraySpreads invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
