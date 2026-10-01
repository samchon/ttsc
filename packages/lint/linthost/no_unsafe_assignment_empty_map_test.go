package linthost

import "testing"

// TestNoUnsafeAssignmentEmptyMap preserves upstream's empty-constructor
// exception while still rejecting an explicit unsafe Map instantiation.
//
// 1. Assign explicit `Map<any, any>` and an untyped empty `new Map()`.
// 2. Add an explicitly safe Map construction as the same-target twin.
// 3. Require only the explicit unsafe generic assignment to report.
// @evidence contracts/testing.md#behavioral-verification The empty Map constructor exemption must not exempt explicit unsafe generic sources.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored Map<any,any> to Map<string,string> finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases untyped empty and explicitly safe Map constructions stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentEmptyMap invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentEmptyMap(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const unsafeMap: Map<any, any>;

// expect: typescript/no-unsafe-assignment error
const unsafe: Map<string, string> = unsafeMap;
const empty: Map<string, string> = new Map();
const safe: Map<string, string> = new Map<string, string>();

void [unsafe, empty, safe];
`)
}
