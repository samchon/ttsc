package linthost

import "testing"

// TestFixPreferConstCountsNestedWriteInShorthandDefault verifies default expressions keep their writes.
//
// A shorthand destructuring default is a read expression inside the outer
// assignment target. A binary assignment nested in that expression is still a
// real reassignment and must prevent an initialized let from becoming const.
//
//  1. Initialize a mutable binding and declare a destructuring target.
//  2. Reassign the mutable binding inside the target's shorthand default.
//  3. Assert prefer-const offers no automatic edit for either declaration.
func TestFixPreferConstCountsNestedWriteInShorthandDefault(t *testing.T) {
  assertNoFixSnapshot(t, "prefer-const", `let mutable = 0;
let target: number;
({ target = (mutable = 1) } = {});
console.log(mutable, target);
`)
}
