package linthost

import "testing"

// TestNoUnsafeAssignmentAliases covers aliases that resolve to the same
// generic target without comparing printed type names.
//
// 1. Hide nested `Set` references behind source and receiver aliases.
// 2. Pair a string receiver with unknown and identical-any receivers.
// 3. Require only the concrete aliased mismatch to report.
// @evidence contracts/testing.md#behavioral-verification Generic aliases must retain unsafe nested same-target arguments.
// @evidence contracts/testing.md#independent-expectations The fixture's independently authored expect markers require one concrete SourceAlias<any> to ReceiverAlias<string> assignment; the oracle compares the complete sorted rule/error line multiset, error message prefix, code 2 and empty stdout.
// @evidence contracts/testing.md#distinguishing-cases ReceiverAlias<unknown> and identical any aliases stay clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeAssignmentAliases invokes assertNoUnsafeAssignmentCase and the in-process check command with a real Program/Checker; fixture project files configure that operation, with no installed consumer, native build or child compiler.
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
