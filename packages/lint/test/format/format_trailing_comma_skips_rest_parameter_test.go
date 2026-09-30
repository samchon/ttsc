package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatTrailingCommaSkipsRestParameter verifies the rule refuses to
// insert a trailing comma after a rest parameter.
//
// A rest parameter must stay the last formal parameter without a following comma. This grammar restriction must override the all-mode multiline insertion policy.
//
//  1. Parse a multi-line function declaration whose last parameter is
//     a rest parameter without a trailing comma.
//  2. Run formatTrailingComma with mode:"all".
//  3. Assert zero findings. The rule must not propose an edit that
//     would render the source unparseable.
//
// @evidence contracts/testing.md#behavioral-verification The function rest parameter must remain comma-free and every original array/call token must survive. The direct no-finding assertion detects inserting invalid rest-parameter punctuation.
// @evidence contracts/testing.md#independent-expectations ECMAScript formal-parameter grammar forbids a comma after a rest parameter. The literal source is already valid, so unchanged punctuation is required independently of the AST rest-token check.
// @evidence contracts/testing.md#distinguishing-cases The last parameter is rest while its preceding parameter is ordinary. The ordinary function-parameter insertion host supplies a positive; value array spread is separately legal.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaSkipsRestParameter owns every authored source, no-finding or complete-output assertion in the public Go unit population. The syntax-only owning rule and edit harness execute in one Go process without consumer installation, native product builds or a product-host child.
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
