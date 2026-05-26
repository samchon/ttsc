package linthost

import (
	"encoding/json"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

func reactPerfFindingLines(t *testing.T, ruleName, fileName, source string, options json.RawMessage) []int {
	t.Helper()
	resolver := InlineRuleResolver{
		Rules: RuleConfig{ruleName: SeverityError},
	}
	if len(options) > 0 {
		resolver.Options = RuleOptionsMap{ruleName: options}
	}
	file := parseTSXFile(t, fileName, source)
	findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
	lines := make([]int, 0, len(findings))
	for _, finding := range findings {
		if finding.Rule != ruleName {
			t.Fatalf("expected rule %s, got %s", ruleName, finding.Rule)
		}
		lines = append(lines, shimscanner.GetECMALineOfPosition(file, finding.Pos)+1)
	}
	return lines
}

func reactPerfAssertLines(t *testing.T, ruleName, source string, want []int) {
	t.Helper()
	got := reactPerfFindingLines(t, ruleName, "/virtual/main.tsx", source, nil)
	if len(got) != len(want) {
		t.Fatalf("%s: want lines %v, got %v", ruleName, want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%s[%d]: want line %d, got %d; all lines=%v", ruleName, i, want[i], got[i], got)
		}
	}
}

func reactPerfAssertZero(t *testing.T, ruleName, fileName, source string, options json.RawMessage) {
	t.Helper()
	got := reactPerfFindingLines(t, ruleName, fileName, source, options)
	if len(got) != 0 {
		t.Fatalf("%s: expected zero findings, got lines %v", ruleName, got)
	}
}
