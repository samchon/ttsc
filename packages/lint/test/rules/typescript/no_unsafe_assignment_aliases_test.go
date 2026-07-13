package linthost

import "testing"

// TestNoUnsafeAssignmentAliases covers aliases that resolve to the same
// generic target without comparing printed type names.
//
// 1. Hide nested `Set` references behind source and receiver aliases.
// 2. Pair a string receiver with unknown and identical-any receivers.
// 3. Require only the concrete aliased mismatch to report.
func TestNoUnsafeAssignmentAliases(t *testing.T) {
  assertNoUnsafeAssignmentCase(t, `type SourceAlias<T> = Set<Set<T>>;
type ReceiverAlias<T> = Set<Set<T>>;
declare const source: SourceAlias<any>;

// expect: typescript/no-unsafe-assignment error
const concrete: ReceiverAlias<string> = source;
const boundary: ReceiverAlias<unknown> = source;
const same: ReceiverAlias<any> = source;

void [concrete, boundary, same];
`)
}
