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
//
// @evidence contracts/testing.md#behavioral-verification prefer-const reports eligible assignedLater/stable but does not move assignments or split mixed destructuring automatically.
// @evidence contracts/testing.md#independent-expectations The full original source and zero edits preserve assignedLater placement and mutable sibling updates.
// @evidence contracts/testing.md#distinguishing-cases Declaration-then-assignment and partially stable destructuring require nonlocal edits, unlike wholly stable initialized destructuring.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly executes assertNoFixSnapshot through the real checker and disk applier.
func TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly(t *testing.T) {
  assertNoFixSnapshot(t, "prefer-const", `let assignedLater: number;
assignedLater = 1;

const input = { stable: 1, mutable: 2 };
let { stable, mutable } = input;
mutable += 1;

console.log(assignedLater, stable, mutable);
`)
}
