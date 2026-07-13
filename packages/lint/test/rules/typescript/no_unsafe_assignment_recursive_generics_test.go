package linthost

import "testing"

// TestNoUnsafeAssignmentRecursiveGenerics covers arbitrary-depth same-target
// type argument comparison and the recursive `unknown` exception.
//
// 1. Assign `Set<Set<Set<any>>>` to matching string and unknown targets.
// 2. Assign it to its identical type as the safe same-type twin.
// 3. Require only the deeply nested concrete mismatch to report.
func TestNoUnsafeAssignmentRecursiveGenerics(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const nested: Set<Set<Set<any>>>;

// expect: typescript/no-unsafe-assignment error
const concrete: Set<Set<Set<string>>> = nested;
const boundary: Set<Set<Set<unknown>>> = nested;
const same: Set<Set<Set<any>>> = nested;

void [concrete, boundary, same];
`)
}
