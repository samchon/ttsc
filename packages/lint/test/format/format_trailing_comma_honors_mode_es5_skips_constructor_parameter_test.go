package main

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaHonorsModeEs5SkipsConstructorParameter verifies
// the rule emits no findings on a multi-line constructor parameter list
// under `mode: "es5"`.
//
// Constructors carry the same ES2015 class-syntax surface as methods, so
// `trailingComma: "es5"` excludes them. The `KindConstructor` arm
// short-circuits on the es5 guard. Pinning the skip protects the peer of
// the method-parameter test.
//
// 1. Parse a source file with one class whose constructor parameter list
//    spans multiple lines.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsConstructorParameter(t *testing.T) {
  source := "class Point {\n  constructor(\n    public x: number,\n    public y: number\n  ) {}\n}\nPoint;\n"
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
