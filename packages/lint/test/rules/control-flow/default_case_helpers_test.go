package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// lintDefaultCase runs the native Engine over `source` with only the
// default-case rule enabled (at error severity) and returns the raw findings
// plus the parsed file for line assertions. A non-empty `options` JSON blob is
// forwarded through the typed rule-options transport, exactly like a
// `["error", {...}]` tuple in a lint config.
//
// Shared by the default_case_* test files so each scenario stays a single
// assertion over one annotated source snippet.
func lintDefaultCase(t *testing.T, source string, options string) (*shimast.SourceFile, []*Finding) {
  t.Helper()
  file := parseTSFile(t, "/virtual/default-case.ts", source)
  rules := RuleConfig{"default-case": SeverityError}
  var resolver RuleResolver = rules
  if options != "" {
    resolver = InlineRuleResolver{
      Rules:   rules,
      Options: RuleOptionsMap{"default-case": json.RawMessage(options)},
    }
  }
  return file, NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
}

// assertDefaultCaseClean asserts that the scenario produced zero findings.
func assertDefaultCaseClean(t *testing.T, source string, options string) {
  t.Helper()
  file, findings := lintDefaultCase(t, source, options)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %+v", normalizeRuleFindings(file, findings))
  }
}

// assertDefaultCaseReportsAtLines asserts the scenario produced exactly one
// finding per expected 1-based line, in order.
func assertDefaultCaseReportsAtLines(t *testing.T, source string, options string, lines ...int) {
  t.Helper()
  file, findings := lintDefaultCase(t, source, options)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(lines) {
    t.Fatalf("expected %d finding(s) at lines %v, got %+v", len(lines), lines, actual)
  }
  for i, line := range lines {
    if actual[i].Rule != "default-case" || actual[i].Line != line {
      t.Fatalf("finding[%d]: expected default-case at line %d, got %+v", i, line, actual)
    }
  }
}
