package main

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter verifies
// the rule emits no findings on a multi-line setter parameter under
// `mode: "es5"`.
//
// Set accessors take exactly one parameter; ES5 grammar disallows a
// trailing comma after it. The `KindSetAccessor` arm short-circuits on
// the es5 guard before `considerFunctionParameterComma`. Pinning the
// skip keeps the asymmetric peer of `KindGetAccessor` regression-safe
// (the getter takes zero parameters and has no positive insert case to
// pin separately).
//
// 1. Parse a source file with one class whose setter parameter spans
//    multiple lines.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsSetAccessorParameter(t *testing.T) {
  source := "class Box {\n  private _value = 0;\n  set value(\n    next: number\n  ) {\n    this._value = next;\n  }\n}\nBox;\n"
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
