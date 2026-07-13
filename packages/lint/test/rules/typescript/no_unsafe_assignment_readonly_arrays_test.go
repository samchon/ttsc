package linthost

import "testing"

// TestNoUnsafeAssignmentReadonlyArrays covers readonly-array type arguments
// without treating arrays as fixture-specific names.
//
// 1. Assign `readonly any[]` to concrete and unknown readonly arrays.
// 2. Assign a concrete readonly array to itself as the safe same-type twin.
// 3. Require only the concrete element mismatch to report.
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
