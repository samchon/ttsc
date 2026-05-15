package main

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaHonorsModeEs5SkipsTupleElement verifies the rule
// emits no findings on a multi-line tuple type under `mode: "es5"`.
//
// Tuple types are TypeScript-only and have no ES5 grammar surface at all;
// the rule treats them as a runtime-skipped construct under `mode: "es5"`
// (the docstring on the `KindTupleType` arm calls this out explicitly).
// Pinning the skip keeps the type-level branch regression-safe alongside
// the runtime peer arms.
//
// 1. Parse a source file with one multi-line tuple type alias.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsTupleElement(t *testing.T) {
  source := "type Pair = [\n  number,\n  string\n];\nconst v: Pair = [1, \"a\"];\nv;\n"
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
