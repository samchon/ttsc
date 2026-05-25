package linthost

import (
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
// 2. Run the noVar engine.
// 3. Assert exactly two findings (first and third lines); the middle line is suppressed.
func TestEngineRespectsESLintDisableLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"noVar": SeverityError})
  file := parseTS(t, `
    var before = 1;
    var skipped = 2; // eslint-disable-line noVar
    var after = 3;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
