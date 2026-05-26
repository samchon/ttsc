package linthost

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

func runBoundaryRule(t *testing.T, ruleName, sourcePath, source, optsJSON string, extraFiles map[string]string) []*Finding {
	t.Helper()
	root := t.TempDir()
	fullSourcePath := filepath.Join(root, filepath.FromSlash(sourcePath))
	writeFile(t, fullSourcePath, source)
	for rel, text := range extraFiles {
		writeFile(t, filepath.Join(root, filepath.FromSlash(rel)), text)
	}
	file := parseTSFile(t, fullSourcePath, source)
	resolver := InlineRuleResolver{
		Rules:   RuleConfig{ruleName: SeverityError},
		Options: RuleOptionsMap{ruleName: json.RawMessage(optsJSON)},
	}
	return NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
}

func assertSingleBoundaryFinding(t *testing.T, ruleName string, findings []*Finding, messagePart string) {
	t.Helper()
	if len(findings) != 1 {
		t.Fatalf("%s: want one finding, got %d (%+v)", ruleName, len(findings), findings)
	}
	if findings[0].Rule != ruleName {
		t.Fatalf("want rule %q, got %q", ruleName, findings[0].Rule)
	}
	if !strings.Contains(findings[0].Message, messagePart) {
		t.Fatalf("want message containing %q, got %q", messagePart, findings[0].Message)
	}
	if len(findings[0].Fix) != 0 {
		t.Fatalf("%s: boundaries diagnostics must not offer autofixes", ruleName)
	}
}
