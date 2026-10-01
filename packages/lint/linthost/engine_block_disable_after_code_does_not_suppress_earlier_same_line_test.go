package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine verifies that a
// block-disable comment placed after code on the same line does not retroactively
// suppress findings from earlier tokens on that line.
//
// The directive filter replays ordered disable events keyed on comment positions.
// A `/* eslint-disable */` comment mid-line must open the disabled range only from
// that comment's own position forward; findings anchored to tokens before the comment
// byte-offset must not be suppressed. This pins the ordering invariant in the interval
// lookup so a future refactor cannot accidentally treat mid-line disables as
// beginning-of-line disables.
//
// 1. Parse a line where `var reported = 1` precedes an `eslint-disable` block comment.
// 2. Run the no-var engine on that source.
// 3. Assert exactly one finding — the earlier token is reported, the later line is suppressed.
//
// @evidence contracts/testing.md#behavioral-verification A block disable after an earlier var token retains that token while suppressing the following statement.
// @evidence contracts/testing.md#independent-expectations The literal earlier var offset defines the sole error survivor, preventing the later statement from substituting for it.
// @evidence contracts/testing.md#distinguishing-cases Code before a same-line disable and code on the next line distinguish byte-position activation from retroactive whole-line suppression.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  source := `
    var reported = 1; /* eslint-disable no-var */
    var skipped = 2;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
  expected := []int{strings.Index(source, "var reported")}
  for i, pos := range expected {
    finding := findings[i]
    if pos < 0 || finding.File != file || finding.Rule != "no-var" || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("finding %d: want no-var error at %d, got %+v", i, pos, finding)
    }
  }
}
