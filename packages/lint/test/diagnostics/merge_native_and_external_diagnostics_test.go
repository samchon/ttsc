package main

import (
  "testing"

  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// TestMergeNativeAndExternalDiagnostics verifies external diagnostics replace duplicates.
//
// When ESLint runtime diagnostics are available, native fallback diagnostics for
// the same canonical rule should be suppressed. Different native rules must
// remain so runtime and native coverage can complement each other.
//
// This scenario covers mergeNativeAndExternalDiagnostics plus rule extraction
// and canonicalization from rendered lint messages.
//
// 1. Build native diagnostics for no-var and eqeqeq.
// 2. Build an external diagnostic for @typescript-eslint/no-var.
// 3. Assert no-var is replaced while eqeqeq remains.
func TestMergeNativeAndExternalDiagnostics(t *testing.T) {
  native := []*shimdw.LintDiagnostic{
    shimdw.NewLintDiagnostic(nil, 0, 1, 1, shimdw.LintCategoryError, "[no-var] native"),
    shimdw.NewLintDiagnostic(nil, 0, 1, 2, shimdw.LintCategoryError, "[eqeqeq] native"),
  }
  external := []*shimdw.LintDiagnostic{
    shimdw.NewLintDiagnostic(nil, 0, 1, 3, shimdw.LintCategoryError, "[@typescript-eslint/no-var] external"),
  }
  merged := mergeNativeAndExternalDiagnostics(native, external)
  if len(merged) != 2 {
    t.Fatalf("expected 2 merged diagnostics, got %d", len(merged))
  }
  if lintDiagnosticRule(merged[0]) != "eqeqeq" || lintDiagnosticRule(merged[1]) != "@typescript-eslint/no-var" {
    t.Fatalf("unexpected merge order/rules: %q %q", lintDiagnosticRule(merged[0]), lintDiagnosticRule(merged[1]))
  }
  if canonicalLintRule("typescript-eslint/no-var") != "no-var" {
    t.Fatalf("canonical rule normalization failed")
  }
}
