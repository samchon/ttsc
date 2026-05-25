package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveWithoutRulesDisablesAllRulesOnTargetLine verifies that an
// `eslint-disable-next-line` directive with no rule list suppresses every enabled rule
// on the following line.
//
// When the rule list is absent the directive parser must set the suppression scope to
// the universal wildcard so ALL rules are skipped for that target line. This is the
// "blanket disable" branch — distinct from the named-rule branch tested elsewhere.
// Getting this wrong means a bare disable comment still lets specific rules fire.
//
//  1. Enable two rules (noVar and noDebugger) and parse two lines: a suppressed line
//     and an unsuppressed line, each with both offending constructs.
//  2. Run the engine.
//  3. Assert exactly two findings (one per rule on the non-suppressed line).
func TestEngineDirectiveWithoutRulesDisablesAllRulesOnTargetLine(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "no-var":      SeverityError,
    "no-debugger": SeverityError,
  })
  file := parseTS(t, `
    // eslint-disable-next-line
    var skipped = 1; debugger;
    var reported = 2; debugger;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}
