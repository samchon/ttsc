package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "testing"
)

// TestContributorRangeFixBoundsDiagnosticIndependentlyFromEdit verifies the
// public fix-reporting adapter. A malformed diagnostic span must be bounded
// without shifting or discarding an otherwise valid candidate edit; the two
// ranges have separate contracts and consumers.
//
//  1. Report a malformed diagnostic span alongside a valid 0..5 let edit through the public contributor adapter.
//  2. Require diagnostic EOF bounds without altering the independent edit or original message.
//
// @evidence contracts/testing.md#behavioral-verification Real contributor public range-fix delegation bounds a malformed diagnostic at EOF while preserving the original message and complete candidate replacement edit 0..5 let.
// @evidence contracts/testing.md#independent-expectations Authored source length specifies the EOF diagnostic independently of the normalizer, while literal 0..5 let specifies a separate unchanged edit; neither expected coordinate is taken from the actual finding.
// @evidence contracts/testing.md#distinguishing-cases Malformed 999..-5 diagnostic bounds contrast with a valid replacement edit; exact cardinality, identity/severity guard and message prevent panic recovery or dropped candidate data from satisfying range checks.
// @evidence contracts/testing.md#execution-ownership Actual public contributor adapter and Engine dispatch execute directly in-process with registered contributor cleanup; the unit observes collected candidate data rather than executing a native producer or applying edits through an installed CLI.
func TestContributorRangeFixBoundsDiagnosticIndependentlyFromEdit(t *testing.T) {
  file := parseTSFile(t, "/virtual/range-fix.ts", "const value = 1;\n")
  contributor := &boundedDiagnosticRangeContributor{
    spans:   map[string][2]int{file.FileName(): {999, -5}},
    fixFile: file.FileName(),
  }
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  Register(newContributorAdapter(metadata))
  t.Cleanup(func() { delete(registered.rules, contributor.Name()) })

  findings := NewEngine(RuleConfig{contributor.Name(): SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{contributor.Name(): SeverityError}, findings); err != nil {
    t.Fatal(err)
  }
  if got, want := len(findings), 1; got != want {
    t.Fatalf("findings = %d, want %d: %+v", got, want, findings)
  }
  finding := findings[0]
  sourceLen := len(file.Text())
  if got, want := [2]int{finding.Pos, finding.End}, [2]int{sourceLen, sourceLen}; got != want {
    t.Fatalf("diagnostic range = %v, want EOF %v", got, want)
  }
  if got, want := finding.Fix, []TextEdit{{Pos: 0, End: 5, Text: "let"}}; len(got) != len(want) || got[0] != want[0] {
    t.Fatalf("candidate edit = %+v, want %+v", got, want)
  }
  if finding.Message != "explicit contributor range" {
    t.Fatalf("range-fix message changed: %q", finding.Message)
  }
}
