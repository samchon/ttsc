package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine verifies that a
// block-disable comment placed after code on the same line does not retroactively
// suppress findings from earlier tokens on that line.
//
// The directive parser builds a sorted interval tree keyed on token start positions.
// A `/* eslint-disable */` comment mid-line must open the disabled range only from
// that comment's own position forward; findings anchored to tokens before the comment
// byte-offset must not be suppressed. This pins the ordering invariant in the interval
// lookup so a future refactor cannot accidentally treat mid-line disables as
// beginning-of-line disables.
//
// 1. Parse a line where `var reported = 1` precedes an `eslint-disable` block comment.
// 2. Run the no-var engine on that source.
// 3. Assert exactly one finding — the earlier token is reported, the later line is suppressed.
func TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var reported = 1; /* eslint-disable no-var */
    var skipped = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
}
