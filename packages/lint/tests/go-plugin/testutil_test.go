// External test package for the @ttsc/lint rule corpus.
//
// All tests for the lint plugin live under this directory rather than
// alongside the rule sources. To make that possible, every test goes
// through the lint package's public API:
//
//   - `lintpkg.LookupRule(name)` to fetch a rule by its ESLint-style name.
//   - `lintpkg.NewEngine(config)` + `engine.Run(files, checker)` to drive
//     the rule against a parsed source file.
//
// Helper functions defined here (`parseTS`, `assertFindings`,
// `assertNoFindings`) are the only things every rule test needs.
package lint_test

import (
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

// parseTS parses a TypeScript snippet under a virtual absolute file
// name (the parser refuses relative paths). Returns the SourceFile the
// engine will receive at runtime.
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

// assertFindings runs the rule named `ruleName` over `source` at the
// given severity and checks the engine's emitted messages match `want`
// (unordered; duplicates count). Returns the raw findings so a caller
// can pin extra invariants like length or exact position.
func assertFindings(t *testing.T, ruleName string, source string, severity lintpkg.Severity, want []string) []*lintpkg.Finding {
	t.Helper()
	if lintpkg.LookupRule(ruleName) == nil {
		t.Fatalf("rule %q is not registered", ruleName)
	}
	file := parseTS(t, source)
	engine := lintpkg.NewEngine(lintpkg.RuleConfig{ruleName: severity})
	findings := engine.Run([]*shimast.SourceFile{file}, nil)
	got := make([]string, 0, len(findings))
	for _, f := range findings {
		got = append(got, f.Message)
	}
	if !sameMessages(got, want) {
		t.Errorf(
			"rule %q on %q\n  want: %v\n  got:  %v",
			ruleName, oneLine(source), want, got,
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
