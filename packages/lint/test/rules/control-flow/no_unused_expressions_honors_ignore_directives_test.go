package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUnusedExpressionsHonorsIgnoreDirectives verifies no-unused-expressions applies the loose directive view under ignoreDirectives.
//
// Locks the seeThroughParens variant of `noUnusedExpressionsIsDirective`:
// upstream evaluates `ignoreDirectives` against an ESTree, which has no
// parenthesized-expression nodes, so a parenthesized string inside the
// leading string run is exempt under the option (while the strict default
// reports it — pinned by the directive-boundaries corpus fixture). The loose
// view is still positional: a string after the first non-string statement and
// a string inside a class static block stay reported.
//
// 1. Parse a file whose leading run mixes parenthesized and bare strings.
// 2. Run the native Engine with no-unused-expressions configured with ignoreDirectives.
// 3. Assert only the misplaced and static-block strings are reported.
func TestNoUnusedExpressionsHonorsIgnoreDirectives(t *testing.T) {
  const ruleName = "no-unused-expressions"
  source := `("use strict");
"use client";
const ready: boolean = true;
"misplaced";
void ready;

class Widget {
  static {
    "use static";
  }
}
void Widget;
`
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules:   RuleConfig{ruleName: SeverityError},
    Options: RuleOptionsMap{ruleName: json.RawMessage(`{"ignoreDirectives":true}`)},
  }
  findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: ruleName, Severity: SeverityError, Line: 4},
    {Rule: ruleName, Severity: SeverityError, Line: 9},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
