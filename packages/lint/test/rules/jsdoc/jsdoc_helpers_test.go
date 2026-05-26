package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func assertJSDocRuleLines(t *testing.T, ruleName, source string, lines ...int) {
  t.Helper()
  file := parseTSFile(t, "/virtual/jsdoc.ts", source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(lines) {
    t.Fatalf("%s: want lines %v, got %+v", ruleName, lines, actual)
  }
  for i, line := range lines {
    if actual[i].Rule != ruleName || actual[i].Severity != SeverityError || actual[i].Line != line {
      t.Fatalf("%s[%d]: want line %d, got %+v; all findings=%+v", ruleName, i, line, actual[i], actual)
    }
  }
}
