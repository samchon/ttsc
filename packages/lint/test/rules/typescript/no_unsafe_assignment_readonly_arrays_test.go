package linthost

import "testing"

// TestNoUnsafeAssignmentReadonlyArrays covers readonly-array type arguments
// without treating arrays as fixture-specific names.
//
// 1. Assign `readonly any[]` to concrete and unknown readonly arrays.
// 2. Assign a concrete readonly array to itself as the safe same-type twin.
// 3. Require only the concrete element mismatch to report.
// @evidence contracts/testing.md#behavioral-verification Readonly array comparison must inspect same-target element arguments.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored readonly-any to readonly-string finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases readonly unknown receiver and identical string array stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentReadonlyArrays invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentReadonlyArrays(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const source: readonly any[];
declare const safeSource: readonly string[];

// expect: typescript/no-unsafe-assignment error
const concrete: readonly string[] = source;
const boundary: readonly unknown[] = source;
const safe: readonly string[] = safeSource;

void [concrete, boundary, safe];
`)
}
