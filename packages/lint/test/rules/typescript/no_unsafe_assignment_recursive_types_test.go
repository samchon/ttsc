package linthost

import "testing"

// TestNoUnsafeAssignmentRecursiveTypes covers recursive generic aliases and
// cycle termination for identical recursive types.
//
// 1. Compare recursive tuple aliases whose leaf arguments are `any` and string.
// 2. Pair them with recursive unknown and identical recursive assignments.
// 3. Require one concrete mismatch and allow the cycle-safe twins.
// @evidence contracts/testing.md#behavioral-verification Recursive aliases must expose unsafe leaves while terminating equal-type cycles.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one authored Recursive<any> to Recursive<string> finding; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases recursive unknown, identical recursive and cyclic identical tuples stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentRecursiveTypes invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
func TestNoUnsafeAssignmentRecursiveTypes(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `type Recursive<T> = [T, Recursive<T>[]];
type Cycle = [string, Cycle[]];
declare const source: Recursive<any>;
declare const cycle: Cycle;

// expect: typescript/no-unsafe-assignment error
const concrete: Recursive<string> = source;
const boundary: Recursive<unknown> = source;
const same: Recursive<any> = source;
const safeCycle: Cycle = cycle;

void [concrete, boundary, same, safeCycle];
`)
}
