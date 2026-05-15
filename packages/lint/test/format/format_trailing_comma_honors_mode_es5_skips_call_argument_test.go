package main

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaHonorsModeEs5SkipsCallArgument verifies the rule
// emits no findings on a multi-line call expression under `mode: "es5"`.
//
// Prettier's `trailingComma: "es5"` adds commas only where ES5 grammar
// accepted them; trailing commas in call arguments arrived in ES2017, so
// prettier excludes them in es5 mode. The rule's `KindCallExpression`
// dispatch arm short-circuits on the es5 guard. This case pins that
// guard so a future refactor that drops the early return cannot regress
// the parity claim.
//
// 1. Parse a source file with one multi-line call expression.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsCallArgument(t *testing.T) {
  source := "declare function foo(a: number, b: number): number;\nfoo(\n  1,\n  2\n);\n"
  file := parseTS(t, source)
  resolver := InlineRuleResolver{
    Rules: RuleConfig{"format/trailing-comma": SeverityError},
    Options: RuleOptionsMap{
      "format/trailing-comma": json.RawMessage(`{"mode":"es5"}`),
    },
  }
  findings := NewEngineWithResolver(resolver).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
