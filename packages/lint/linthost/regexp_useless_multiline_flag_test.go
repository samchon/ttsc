package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestRegexpUselessMultilineFlag verifies regexp/no-useless-flag on the `m` flag.
//
// `m` changes the `^` and `$` assertions rather than their literal characters.
// The authored flat and nested v-mode classes, escaped anchors and escaped
// opening bracket distinguish these payloads from top-level, group and lookahead
// assertions. The predicate walks the regexp AST and preserves these boundaries.
//
//  1. Enable `regexp/no-useless-flag` on one regex literal per case.
//  2. Run the engine on each.
//  3. Assert `m` is reported exactly when the pattern has no `^`/`$` assertion.
//
// @evidence contracts/testing.md#behavioral-verification Reports m when no real anchor changes meaning and retains it when anchors occur outside character classes.
// @evidence contracts/testing.md#independent-expectations ECMAScript m changes ^/$ assertions, not literal or escaped characters; authored report booleans/reasons independently classify all nine patterns.
// @evidence contracts/testing.md#distinguishing-cases Class, v-class and escaped anchor negatives for usefulness contrast with top-level/group/lookahead live assertions and an escaped-open-bracket boundary.
// @evidence contracts/testing.md#execution-ownership The Test loop calls parseTS and NewEngine.Run for every literal regex/report/reason row. Errorf collects all independent failures rather than stopping at the first; each row remains owned by this Test. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestRegexpUselessMultilineFlag(t *testing.T) {
  cases := []struct {
    literal string
    report  bool
    reason  string
  }{
    // Dead `m`: no assertion for it to redefine.
    {`/\d+/m`, true, "no anchor at all"},
    {`/[$^]/m`, true, "inside a class, $ and ^ are literal characters"},
    {`/[[a]^]/vm`, true, "and they stay literal inside a v-mode nested class"},
    {`/a\^b\$c/m`, true, "escaped anchors match the characters themselves"},

    // Live `m`: an anchor changes meaning per line.
    {`/^\d+$/m`, false, "both anchors"},
    {`/\d$/m`, false, "a trailing anchor is enough"},
    {`/(?:^a)/m`, false, "an anchor nested in a group counts"},
    {`/(?=^\d)/m`, false, "so does one inside a lookahead"},
    {`/\[^a]/m`, false, "the class never opens: [ is escaped, so ^ asserts"},
  }
  for _, tc := range cases {
    source := "const value = " + tc.literal + ";\n"
    file := parseTS(t, source)
    findings := NewEngine(RuleConfig{
      "regexp/no-useless-flag": SeverityError,
    }).Run([]*shimast.SourceFile{file}, nil)
    actual := normalizeRuleFindings(file, findings)
    expected := []ruleExpectation{}
    if tc.report {
      expected = append(expected, ruleExpectation{
        Rule:     "regexp/no-useless-flag",
        Severity: SeverityError,
        Line:     1,
      })
    }
    // Errorf, not Fatalf: every case is independent, and a regression in the
    // anchor walk usually breaks more than one of them at once.
    if len(actual) != len(expected) {
      t.Errorf("%s (%s): want %v, got %v", tc.literal, tc.reason, expected, actual)
      continue
    }
    for i := range expected {
      if actual[i] != expected[i] {
        t.Errorf("%s (%s): want %+v, got %+v", tc.literal, tc.reason, expected[i], actual[i])
      }
    }
    recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  }
}
