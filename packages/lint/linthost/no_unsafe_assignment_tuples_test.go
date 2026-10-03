package linthost

import "testing"

// TestNoUnsafeAssignmentTuples covers tuple type arguments through the shared
// same-target recursive comparison.
//
// 1. Assign a tuple with two `any` elements to a concrete tuple target.
// 2. Repeat with `unknown` receivers and an identical tuple as safe twins.
// 3. Require one finding for the annotated tuple boundary, not one per argument.
//
// @evidence contracts/testing.md#behavioral-verification Tuple type argument comparison must retain one report per assignment boundary.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored concrete tuple assignment finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases unknown receiver and identical tuple stay clean; nested structural properties are not a general runtime-safety proof.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentTuples invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentTuples(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `declare const tuple: [any, { value: any }];

// expect: typescript/no-unsafe-assignment error
const concrete: [string, { value: string }] = tuple;
const boundary: [unknown, { value: any }] = tuple;
const same: [any, { value: any }] = tuple;

void [concrete, boundary, same];
`)
}
