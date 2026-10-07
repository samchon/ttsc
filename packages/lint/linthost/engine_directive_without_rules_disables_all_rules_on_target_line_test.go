package linthost

import (
  "strings"
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
//
// @evidence contracts/testing.md#behavioral-verification A bare next-line directive suppresses both enabled rules on its target line, retaining no-var and no-debugger errors on the following line.
// @evidence contracts/testing.md#independent-expectations The reported line and its two authored constructs independently require exactly one finding per canonical rule at their literal offsets.
// @evidence contracts/testing.md#distinguishing-cases Empty rule list and two distinct rules on both lines distinguish universal suppression from named-only suppression and unbounded suppression.
// @evidence contracts/testing.md#execution-ownership Direct NewEngine and Engine.Run exercise the real parser and directive filter on this authored virtual source in one Go process. This individual entry observes Finding objects without installation, native compilation or a host child.
func TestEngineDirectiveWithoutRulesDisablesAllRulesOnTargetLine(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "no-var":      SeverityError,
    "no-debugger": SeverityError,
  })
  source := `
    // eslint-disable-next-line
    var skipped = 1; debugger;
    var reported = 2; debugger;
  `
  file := parseTS(t, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
  expected := map[string]int{
    "no-var":      strings.Index(source, "var reported"),
    "no-debugger": strings.LastIndex(source, "debugger;"),
  }
  for _, finding := range findings {
    pos, ok := expected[finding.Rule]
    if !ok || finding.File != file || finding.Severity != SeverityError || finding.Pos != pos {
      t.Fatalf("unexpected surviving finding: %+v", finding)
    }
    delete(expected, finding.Rule)
  }
  if len(expected) != 0 {
    t.Fatalf("missing surviving rules: %v", expected)
  }
}
