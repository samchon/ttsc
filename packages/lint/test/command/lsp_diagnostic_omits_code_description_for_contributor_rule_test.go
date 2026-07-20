package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestLSPDiagnosticOmitsCodeDescriptionForContributorRule verifies a
// third-party rule's diagnostic carries no documentation URL.
//
// This is the negative twin of the built-in link. The append-only rule-code
// ledger retains removed names, and a contributor may reuse one after its native
// rule disappears. The runtime adapter check must therefore stop the contributor
// from inheriting a ttsc.dev page that documents someone else's rule.
//
//  1. Register a contributor under a retired name still present in the ledger.
//  2. Run the engine so the rule reports one finding.
//  3. Assert the converted LSP diagnostic keeps its rule id but no
//     codeDescription, while a built-in rule still resolves one.
func TestLSPDiagnosticOmitsCodeDescriptionForContributorRule(t *testing.T) {
  file := parseTSFile(t, "/virtual/contributor.ts", "export const value = 1;\n")
  contributor := &undocumentedContributorRule{}
  metadata, err := inspectContributor(contributor)
  if err != nil {
    t.Fatal(err)
  }
  Register(newContributorAdapter(metadata))
  t.Cleanup(func() { delete(registered.rules, contributor.Name()) })

  findings := NewEngine(RuleConfig{contributor.Name(): SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if got, want := len(findings), 1; got != want {
    t.Fatalf("findings = %d, want %d: %+v", got, want, findings)
  }

  diagnostic := findingToLSPDiagnostic(findings[0])
  if diagnostic.Code != contributor.Name() {
    t.Fatalf("diagnostic code = %q, want %q", diagnostic.Code, contributor.Name())
  }
  if diagnostic.CodeDescription != nil {
    t.Fatalf("contributor rule inherited a documentation URL: %#v", diagnostic.CodeDescription)
  }

  // The same conversion must still resolve a built-in rule, so the assertion
  // above pins the contributor exclusion rather than a globally dead field.
  if got := ruleDocumentationURL("no-alert"); got == "" {
    t.Fatal("built-in rule lost its documentation URL alongside the contributor exclusion")
  }
}

type undocumentedContributorRule struct{}

func (*undocumentedContributorRule) Name() string { return "solid/jsx-uses-vars" }
func (*undocumentedContributorRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (*undocumentedContributorRule) Check(ctx *publicrule.Context, _ *shimast.Node) {
  ctx.ReportRange(0, 1, "undocumented contributor finding")
}
