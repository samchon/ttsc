package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsRestParameter verifies the rule refuses to
// insert a trailing comma after a rest parameter.
//
// ECMAScript forbids a trailing comma after a rest element (TS1013).
// A rule that emits `function f(a, ...rest,) {}` produces an invalid
// source file the user can't compile. The fixer detects the rest
// element via `DotDotDotToken` and bails before emitting the edit.
//
//  1. Parse a multi-line function declaration whose last parameter is
//     a rest parameter without a trailing comma.
//  2. Run formatTrailingComma with mode:"all".
//  3. Assert zero findings — the rule must NOT propose an edit that
//     would render the source unparseable.
func TestFormatTrailingCommaSkipsRestParameter(t *testing.T) {
  source := "function f(\n" +
    "  a: string,\n" +
    "  ...rest: number[]\n" +
    ") {\n" +
    "  return [a, ...rest];\n" +
    "}\n" +
    "f(\"x\", 1, 2);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/trailing-comma": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings (rest param disallows trailing comma), got %d:\n%v",
      len(findings), findings)
  }
}
