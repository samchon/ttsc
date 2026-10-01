package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineRespectsESLintDisableLine verifies that `eslint-disable-line` suppresses the
// finding on the same line where the comment appears.
//
// Unlike `eslint-disable-next-line`, the `disable-line` variant must target the comment's
// own line rather than the following line. The directive parser builds two distinct code
// paths for these two forms; this test pins the same-line path so a copy-paste error that
// conflates them (e.g. off-by-one in the target-line calculation) would fail here.
//
// 1. Parse three var statements; the middle one carries a trailing `eslint-disable-line`.
// 2. Run the no-var engine.
// 3. Assert exactly two findings (first and third lines); the middle line is suppressed.
//
// @evidence contracts/testing.md#behavioral-verification A trailing eslint-disable-line suppresses only its own var statement while the adjacent statements remain error findings.
// @evidence contracts/testing.md#independent-expectations The independently authored first and third statement offsets define which two findings must survive.
// @evidence contracts/testing.md#distinguishing-cases The middle trailing comment and two adjacent violating lines distinguish own-line targeting from previous or next-line targeting.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineRespectsESLintDisableLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  source := `
    var before = 1;
    var skipped = 2; // eslint-disable-line no-var
    var after = 3;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "var before"), strings.Index(source, "var after")}
  for i, pos := range expected {
    finding := findings[i]
    if pos < 0 || finding.File != file || finding.Rule != "no-var" || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("finding %d: want no-var error at %d, got %+v", i, pos, finding)
    }
  }
}
