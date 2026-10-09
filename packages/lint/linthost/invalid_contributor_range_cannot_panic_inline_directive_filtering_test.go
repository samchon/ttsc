package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "testing"
)

// TestInvalidContributorRangeCannotPanicInlineDirectiveFiltering pins the
// pre-render path: directive matching must receive the normalized EOF span,
// suppress it normally, and never pass an out-of-bounds offset to the scanner.
//
//  1. Run the beyond-end reporting contributor with and without an authored inline disable directive.
//  2. Require zero disabled findings and one original-message canonical EOF finding in the control.
//
// @evidence contracts/testing.md#behavioral-verification Real adapted contributor beyond-end reports are suppressed by an authored eslint-disable directive without scanner panic; the same contributor without that directive reports one canonical EOF finding.
// @evidence contracts/testing.md#independent-expectations Literal zero findings for the disabled source and one original-message EOF finding for the independently authored control distinguish directive suppression from failed or inert dispatch.
// @evidence contracts/testing.md#distinguishing-cases Out-of-bounds 999..1200 spans exercise normalization before scanner filtering; directive-present versus absent sources share the same contributor identity, and the positive control rejects recovered execution failures.
// @evidence contracts/testing.md#execution-ownership Real inspected contributor registration and Engine.Run parse source directives directly in-process; cleanup removes registration and no native plugin artifact, CLI, install or repository-text inspection executes.
func TestInvalidContributorRangeCannotPanicInlineDirectiveFiltering(t *testing.T) {
  file := parseTSFile(t, "/virtual/directive.ts", `// eslint-disable test/bounded-diagnostic-range
const value = 1;
`)
  contributor := &boundedDiagnosticRangeContributor{
    spans: map[string][2]int{file.FileName().AsString(): {999, 1200}},
  }
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  Register(newContributorAdapter(metadata))
  t.Cleanup(func() { delete(registered.rules, contributor.Name()) })

  findings := NewEngine(RuleConfig{contributor.Name(): SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("normalized EOF finding should be inline-disabled, got %+v", findings)
  }
  plain := parseTSFile(t, "/virtual/directive.ts", "const value = 1;\n")
  control := NewEngine(RuleConfig{contributor.Name(): SeverityError}).Run([]*shimast.SourceFile{plain}, nil)
  if err := validateSemanticRuleFindings(RuleConfig{contributor.Name(): SeverityError}, control); err != nil {
    t.Fatal(err)
  }
  if len(control) != 1 || control[0].Pos != len(plain.Text()) || control[0].End != len(plain.Text()) || control[0].Message != "explicit contributor range" {
    t.Fatalf("same contributor without directive did not report bounded EOF: %+v", control)
  }
}
