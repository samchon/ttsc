package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocSkipsCanonicalTags verifies the rule is idempotent.
//
// A JSDoc block that already uses `@returns`, `@param`, `@description`, etc.
// must not produce any finding. Otherwise the formatter would burn passes
// re-reporting itself. The rule must abstain on canonical names rather
// than returning unnecessary spelling edits.
//
// 1. Parse a source file with only canonical JSDoc tags.
// 2. Run the engine with formatJsdoc enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must emit no findings for canonical param, returns and description tags. The absence oracle detects unnecessary self-rewrites that could waste cascade passes.
// @evidence contracts/testing.md#independent-expectations The supported canonical tag spellings are already present in the authored block. Keeping them and their descriptions unchanged is determined independently of the implementation alias lookup.
// @evidence contracts/testing.md#distinguishing-cases The negative combines three canonical names. Return and argument synonym hosts supply the positive transformations, so this fixed-point case does not stand in for normalization correctness.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocSkipsCanonicalTags owns its parsed source and direct Engine no-finding assertion in the public Go unit population. The rule executes in process without installing a consumer, building native artifacts or starting a product host.
func TestFormatJSDocSkipsCanonicalTags(t *testing.T) {
  source := "/**\n * @param name The name.\n * @returns The greeting.\n * @description Builds a greeting.\n */\nexport function greet(name: string): string { return name; }\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/jsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
