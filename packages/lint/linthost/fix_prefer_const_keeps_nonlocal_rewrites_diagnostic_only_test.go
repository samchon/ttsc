package linthost

import (
  "strings"
  "testing"
)

// TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly verifies unsafe rewrites stay disabled.
//
// A declaration-only binding would require moving its assignment, while one
// stable leaf in a mixed destructuring declaration would require splitting the
// shared `let`. Both remain valid findings, but neither can carry a text edit.
//
//  1. Create one declaration-then-assignment and one partially mutable destructuring.
//  2. Run prefer-const through the disk-backed fix selector.
//  3. Assert both eligible identifiers are reported, no edit is applied and the source remains unchanged.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const reports eligible assignedLater/stable but does not move assignments or split mixed destructuring automatically.
// @evidence contracts/testing.md#independent-expectations Authored assignedLater/stable positions require both findings; the full original source and zero edits preserve assignment placement and mutable sibling updates.
// @evidence contracts/testing.md#distinguishing-cases Declaration-then-assignment and partially stable destructuring require nonlocal edits, unlike wholly stable initialized destructuring.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly executes assertNoFixSnapshot through the real checker and disk applier.
func TestFixPreferConstKeepsNonlocalRewritesDiagnosticOnly(t *testing.T) {
  source := `let assignedLater: number;
assignedLater = 1;

const input = { stable: 1, mutable: 2 };
let { stable, mutable } = input;
mutable += 1;

console.log(assignedLater, stable, mutable);
`
  assertNoFixSnapshot(t, "prefer-const", source)
  _, _, findings := runRuleFindingsSnapshot(t, "prefer-const", source, nil)
  if len(findings) != 2 {
    t.Fatalf("want two nonlocal findings, got %+v", findings)
  }
  for index, expected := range []struct {
    marker string
    offset int
    name   string
  }{
    {marker: "assignedLater = 1", name: "assignedLater"},
    {marker: "let { stable, mutable }", offset: len("let { "), name: "stable"},
  } {
    markerStart := strings.Index(source, expected.marker)
    if markerStart < 0 {
      t.Fatalf("missing authored marker %q", expected.marker)
    }
    start := markerStart + expected.offset
    if finding := findings[index]; finding.Pos != start || finding.End != start+len(expected.name) {
      t.Fatalf("finding %d: want %q at [%d,%d), got %+v", index, expected.name, start, start+len(expected.name), finding)
    }
  }
}
