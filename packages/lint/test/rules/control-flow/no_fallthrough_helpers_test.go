package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// lintNoFallthrough runs the native Engine over `source` with only the
// no-fallthrough rule enabled (at error severity) and returns the raw
// findings plus the parsed file for position assertions. A non-empty
// `options` JSON blob is forwarded through the typed rule-options
// transport, exactly like a `["error", {...}]` tuple in a lint config.
//
// Shared by the no_fallthrough_* test files so each scenario stays a
// single assertion over one annotated source snippet.
func lintNoFallthrough(t *testing.T, source string, options string) (*shimast.SourceFile, []*Finding) {
  t.Helper()
  file := parseTSFile(t, "/virtual/no-fallthrough-case.ts", source)
  rules := RuleConfig{"no-fallthrough": SeverityError}
  var resolver RuleResolver = rules
  if options != "" {
    resolver = InlineRuleResolver{
      Rules:   rules,
      Options: RuleOptionsMap{"no-fallthrough": json.RawMessage(options)},
    }
  }
  return file, NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
}

// assertNoFallthroughClean asserts that the scenario produced zero findings.
func assertNoFallthroughClean(t *testing.T, source string, options string) {
  t.Helper()
  file, findings := lintNoFallthrough(t, source, options)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %+v", normalizeRuleFindings(file, findings))
  }
}

// assertNoFallthroughReportsAtLines asserts the scenario produced exactly
// one finding per expected 1-based line, in order.
func assertNoFallthroughReportsAtLines(t *testing.T, source string, options string, lines ...int) {
  t.Helper()
  file, findings := lintNoFallthrough(t, source, options)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(lines) {
    t.Fatalf("expected %d finding(s) at lines %v, got %+v", len(lines), lines, actual)
  }
  for i, line := range lines {
    if actual[i].Rule != "no-fallthrough" || actual[i].Line != line {
      t.Fatalf("finding[%d]: expected no-fallthrough at line %d, got %+v", i, line, actual)
    }
  }
}
