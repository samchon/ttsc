package lint

// Test helpers for rule tests.
//
// Each rule test boils down to "parse this snippet, run engine with this
// rule enabled, assert the findings". The shim exposes a tiny parser
// surface — `shim/parser.ParseSourceFile` — so we can avoid bootstrapping
// a full Program for unit tests.

import (
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
)

// parseTS parses a TypeScript snippet and returns the resulting
// SourceFile. Tests use it to build the AST a rule will receive when run
// by the engine.
func parseTS(t *testing.T, source string) *shimast.SourceFile {
	t.Helper()
	opts := shimast.SourceFileParseOptions{
		FileName: "/virtual/test.ts",
	}
	file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTS)
	if file == nil {
		t.Fatalf("parser returned nil source file")
	}
	return file
}

// assertFindings runs `rule` over `source` at the given severity and
// checks the rule emits exactly `wantMessages` (unordered, but
// duplicates count). Pass `wantPositions` (substrings of source) to also
// pin where each finding lands.
func assertFindings(t *testing.T, rule Rule, source string, severity Severity, want []string) []*Finding {
	t.Helper()
	file := parseTS(t, source)
	engine := NewEngine(RuleConfig{rule.Name(): severity})
	findings := engine.Run([]*shimast.SourceFile{file}, nil)
	got := make([]string, 0, len(findings))
	for _, f := range findings {
		got = append(got, f.Message)
	}
	if !sameMessages(got, want) {
		t.Errorf(
			"rule %q on %q\n  want: %v\n  got:  %v",
			rule.Name(), oneLine(source), want, got,
		)
	}
	return findings
}

func sameMessages(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	left := append([]string(nil), got...)
	right := append([]string(nil), want...)
	for _, w := range right {
		idx := -1
		for i, g := range left {
			if g == w {
				idx = i
				break
			}
		}
		if idx < 0 {
			return false
		}
		left = append(left[:idx], left[idx+1:]...)
	}
	return true
}

func oneLine(s string) string {
	return strings.TrimSpace(strings.ReplaceAll(s, "\n", "⏎"))
}
