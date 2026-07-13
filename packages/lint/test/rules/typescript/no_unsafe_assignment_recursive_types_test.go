package linthost

import "testing"

// TestNoUnsafeAssignmentRecursiveTypes covers recursive generic aliases and
// cycle termination for identical recursive types.
//
// 1. Compare recursive tuple aliases whose leaf arguments are `any` and string.
// 2. Pair them with recursive unknown and identical recursive assignments.
// 3. Require one concrete mismatch and allow the cycle-safe twins.
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
