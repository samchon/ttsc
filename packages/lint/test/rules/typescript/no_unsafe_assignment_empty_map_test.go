package linthost

import "testing"

// TestNoUnsafeAssignmentEmptyMap preserves upstream's empty-constructor
// exception while still rejecting an explicit unsafe Map instantiation.
//
// 1. Assign explicit `Map<any, any>` and an untyped empty `new Map()`.
// 2. Add an explicitly safe Map construction as the same-target twin.
// 3. Require only the explicit unsafe generic assignment to report.
func TestNoUnsafeAssignmentEmptyMap(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const unsafeMap: Map<any, any>;

// expect: typescript/no-unsafe-assignment error
const unsafe: Map<string, string> = unsafeMap;
const empty: Map<string, string> = new Map();
const safe: Map<string, string> = new Map<string, string>();

void [unsafe, empty, safe];
`)
}
