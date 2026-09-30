package linthost

import "testing"

// TestFormatBlockSeverityWarningEnablesCheckDiagnostics verifies that
// `format.severity: "warning"` opts check/build into format diagnostics.
//
// `format` defaults to check-time off, but the severity escape hatch remains
// useful for projects that intentionally gate formatting in `ttsc check`. This
// test pins that the explicit policy still enables the always-on rules
// (including format/jsdoc) while keeping the opt-in format/sort-imports off
// until its own field is present.
//
//  1. Build an ITtscLintConfig object with `format: { severity: "warning" }`.
//  2. Parse it through `parseExternalConfigStore`.
//  3. Assert always-on format rules are enabled as warnings.
//  4. Assert the opt-in format/sort-imports remains off.
//
// @evidence contracts/testing.md#behavioral-verification parseExternalConfigStore enables five authored always-on formatter names as warnings while leaving opt-in sort-imports absent.
// @evidence contracts/testing.md#independent-expectations Explicit warning severity opts check/build into format diagnostics; the public rule identities and SeverityWarn literals supply independent policy expectations.
// @evidence contracts/testing.md#distinguishing-cases Owns warning-enabled standard and JSDoc rules versus still-unrequested import sorting; default-off and explicit sort true are separate branches.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. An authored warning format object reaches parseExternalConfigStore directly in-process; five literal rule severities and absent import sorter are inspected without a source walk or child compiler.
func TestFormatBlockSeverityWarningEnablesCheckDiagnostics(t *testing.T) {
  resolver, err := parseExternalConfigStore(map[string]any{
    "format": map[string]any{"severity": "warning"},
  }, "")
  if err != nil {
    t.Fatalf("parseExternalConfigStore: %v", err)
  }
  enabled := resolver.EnabledRuleConfig()
  for _, name := range []string{
    "format/semi",
    "format/quotes",
    "format/trailing-comma",
    "format/print-width",
    "format/jsdoc",
  } {
    if got := enabled[name]; got != SeverityWarn {
      t.Errorf("expected %q at warning, got %v", name, got)
    }
  }
  for _, name := range []string{"format/sort-imports"} {
    if _, ok := enabled[name]; ok {
      t.Errorf("expected %q to stay off (opt-in), got enabled", name)
    }
  }
}
