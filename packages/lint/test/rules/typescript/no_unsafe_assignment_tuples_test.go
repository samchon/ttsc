package linthost

import "testing"

// TestNoUnsafeAssignmentTuples covers tuple type arguments through the shared
// same-target recursive comparison.
//
// 1. Assign a tuple with two `any` elements to a concrete tuple target.
// 2. Repeat with `unknown` receivers and an identical tuple as safe twins.
// 3. Require one finding for the annotated tuple boundary, not one per argument.
func TestNoUnsafeAssignmentTuples(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const tuple: [any, { value: any }];

// expect: typescript/no-unsafe-assignment error
const concrete: [string, { value: string }] = tuple;
const boundary: [unknown, { value: any }] = tuple;
const same: [any, { value: any }] = tuple;

void [concrete, boundary, same];
`)
}
