package linthost

import (
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

func assertJsxA11yRuleFinds(t *testing.T, ruleName, source, messagePart string) {
	t.Helper()
	file := parseTSXFile(t, "/virtual/component.tsx", source)
	findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
	if len(findings) != 1 {
		t.Fatalf("%s: expected one finding, got %d: %+v", ruleName, len(findings), findings)
	}
	if messagePart != "" && !strings.Contains(findings[0].Message, messagePart) {
		t.Fatalf("%s: message %q does not contain %q", ruleName, findings[0].Message, messagePart)
	}
}

func assertJsxA11yRuleSkips(t *testing.T, ruleName, source string) {
	t.Helper()
	file := parseTSXFile(t, "/virtual/component.tsx", source)
	findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
	if len(findings) != 0 {
		t.Fatalf("%s: expected zero findings, got %d: %+v", ruleName, len(findings), findings)
	}
}
