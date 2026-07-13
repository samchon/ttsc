package linthost

import "testing"

// TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly verifies unsafe rewrites stay disabled.
//
// A declaration-only binding would require moving its assignment, while one
// stable leaf in a mixed destructuring declaration would require splitting the
// shared `let`. Both remain valid findings, but neither can carry a text edit.
//
//  1. Create one declaration-then-assignment and one partially mutable destructuring.
//  2. Run prefer-const through the disk-backed fix selector.
//  3. Assert no edit is applied and the source remains byte-for-byte unchanged.
func TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly(t *testing.T) {
  assertNoFixSnapshot(t, "prefer-const", `let assignedLater: number;
assignedLater = 1;

const input = { stable: 1, mutable: 2 };
let { stable, mutable } = input;
mutable += 1;

console.log(assignedLater, stable, mutable);
`)
}
