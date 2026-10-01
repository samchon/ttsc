package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

type noRestrictedSyntaxExpectation struct {
  target  string
  message string
}

func runNoRestrictedSyntax(
  t *testing.T,
  source string,
  options json.RawMessage,
  expected ...noRestrictedSyntaxExpectation,
) {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-restricted-syntax", source, options)
  if len(findings) != len(expected) {
    t.Fatalf("no-restricted-syntax finding count mismatch: want=%+v got=%+v", expected, findings)
  }
  searchFrom := 0
  for index, want := range expected {
    relative := strings.Index(source[searchFrom:], want.target)
    if relative < 0 {
      t.Fatalf("expectation %d target %q is absent after byte %d", index, want.target, searchFrom)
    }
    start := searchFrom + relative
    end := start + len(want.target)
    finding := findings[index]
    if finding.Rule != "no-restricted-syntax" || finding.Severity != SeverityError ||
      finding.Pos != start || finding.End != end || finding.Message != want.message {
      t.Fatalf("finding %d mismatch: want=%+v range=[%d,%d) got=%+v", index, want, start, end, finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d unexpectedly offered edits: %+v", index, finding)
    }
    searchFrom = end
  }
}

func noRestrictedDefaultMessage(selector string) string {
  return "Using '" + selector + "' is not allowed."
}

func noRestrictedSyntaxValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-restricted-syntax": SeverityError},
    Options: RuleOptionsMap{
      "no-restricted-syntax": options,
    },
  })
}
