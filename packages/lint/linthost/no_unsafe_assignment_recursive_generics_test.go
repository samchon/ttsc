package linthost

import "testing"

// TestNoUnsafeAssignmentRecursiveGenerics covers three-level same-target
// type argument comparison and the recursive `unknown` exception.
//
// 1. Assign `Set<Set<Set<any>>>` to matching string and unknown targets.
// 2. Assign it to its identical type as the safe same-type twin.
// 3. Require only the deeply nested concrete mismatch to report.
//
// @evidence contracts/testing.md#behavioral-verification Recursive generic comparison must find deeply nested same-target any escapes.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored three-level Set<any> to Set<string> finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases nested unknown and identical any targets stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentRecursiveGenerics invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentRecursiveGenerics(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const nested: Set<Set<Set<any>>>;

// expect: typescript/no-unsafe-assignment error
const concrete: Set<Set<Set<string>>> = nested;
const boundary: Set<Set<Set<unknown>>> = nested;
const same: Set<Set<Set<any>>> = nested;

void [concrete, boundary, same];
`)
}
