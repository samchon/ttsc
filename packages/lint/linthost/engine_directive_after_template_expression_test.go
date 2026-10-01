package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveAfterTemplateExpression verifies that `eslint-disable-next-line`
// continues to suppress findings on lines that follow a template literal containing a
// `${...}` substitution earlier in the file.
//
// The shared comment scanner must preserve the template lexical goal across
// substitutions before classifying later comments. A raw scanner that does not
// rescan template head/middle/tail tokens can drift later comment positions and
// target the wrong line, silently losing the next-line suppression.
//
//  1. Declare a template literal with one `${...}` substitution.
//  2. Place an `eslint-disable-next-line eqeqeq` directive before a `==` comparison.
//  3. Run the eqeqeq engine and assert the comparison is suppressed.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run suppresses eqeqeq after a template substitution when a real next-line directive is present, and reports the same comparison when that directive is removed.
// @evidence contracts/testing.md#independent-expectations The literal comparison uses == rather than ===, so it independently violates eqeqeq; the directive changes reporting without changing the template or comparison semantics.
// @evidence contracts/testing.md#distinguishing-cases A substitution-bearing template precedes both the suppressed case and its directive-free positive control, distinguishing scanner lexical-goal drift from a missing or inactive rule.
// @evidence contracts/testing.md#execution-ownership The same real NewEngine directly walks two separately parsed virtual sources in one Go process. This individual entry inspects actual findings without compiling a consumer or executing the source.
func TestEngineDirectiveAfterTemplateExpression(t *testing.T) {
  engine := NewEngine(RuleConfig{"eqeqeq": SeverityError})
  file := parseTS(t, "const t = `foo${1}bar`;\n// eslint-disable-next-line eqeqeq\nif (1 == 1) {}\n")
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 0 {
    t.Fatalf("want 0 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
  control := parseTS(t, "const t = `foo${1}bar`;\nif (1 == 1) {}\n")
  controlFindings := engine.Run([]*shimast.SourceFile{control}, nil)
  if len(controlFindings) != 1 || controlFindings[0].File != control || controlFindings[0].Rule != "eqeqeq" || controlFindings[0].Severity != SeverityError {
    t.Fatalf("directive-free comparison was not reported: %+v", controlFindings)
  }
}
