package linthost

import (
  "strings"
  "testing"
)

// TestNodeReportBoundsBeforeSkippingTrivia proves a contributor cannot make
// the host slice the current source at another file's otherwise-valid node
// position. Normalization must happen before SkipTrivia, not only afterward.
//
//
//  1. Parse a short current source and a genuine foreign node beyond its length.
//  2. Report that node and require current-source EOF bounds, identity and original message without a trivia-scanning panic.
//
// @evidence contracts/testing.md#behavioral-verification Real node reporting bounds a far-away parsed node from a different source at the current short source EOF before trivia scanning, retaining the current file and original message without panic.
// @evidence contracts/testing.md#independent-expectations Independently authored current x source length determines its EOF; the foreign node is asserted to lie beyond that source before reporting, so the test does not derive its expectation from the normalizer.
// @evidence contracts/testing.md#distinguishing-cases A genuine parsed foreign node contrasts with the valid current source and catches scanning before normalization; nonnil finding plus file identity and message distinguish successful bounded collection from inert reporting.
// @evidence contracts/testing.md#execution-ownership Actual internal Context.Report runs directly against two real parsed virtual sources with an observing collect callback in-process; no native producer, filesystem link, installation or foreign-source text check executes.
func TestNodeReportBoundsBeforeSkippingTrivia(t *testing.T) {
  current := parseTSFile(t, "/virtual/current.ts", "x;\n")
  foreign := parseTSFile(t, "/virtual/foreign.ts", strings.Repeat("const padding = 0;\n", 8)+"target;\n")
  foreignNode := foreign.Statements.Nodes[len(foreign.Statements.Nodes)-1]
  if foreignNode.Pos() <= len(current.Text()) {
    t.Fatalf("fixture node position %d must exceed current source length %d", foreignNode.Pos(), len(current.Text()))
  }

  var finding *Finding
  ctx := &Context{
    File:     current,
    Severity: SeverityError,
    rule:     boundedDiagnosticRangeHostRule{},
    collect:  func(got *Finding) { finding = got },
  }
  ctx.Report(foreignNode, "foreign node")
  if finding == nil {
    t.Fatal("foreign node diagnostic was not reported")
  }
  if got, want := [2]int{finding.Pos, finding.End}, [2]int{len(current.Text()), len(current.Text())}; got != want {
    t.Fatalf("foreign node range = %v, want EOF %v", got, want)
  }
  if finding.File != current || finding.Message != "foreign node" { t.Fatalf("foreign node replaced the current diagnostic source or message: %+v", finding) }
}
