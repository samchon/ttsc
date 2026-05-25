package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocSkipsCanonicalTags verifies the rule is idempotent.
//
// A JSDoc block that already uses `@returns`, `@param`, `@description`, etc.
// must not produce any finding. Otherwise the formatter would burn passes
// re-reporting itself. The canonical-equals-tag shortcut is the only thing
// that prevents that.
//
// 1. Parse a source file with only canonical JSDoc tags.
// 2. Run the engine with formatJsdoc enabled.
// 3. Assert zero findings.
func TestFormatJSDocSkipsCanonicalTags(t *testing.T) {
  source := "/**\n * @param name The name.\n * @returns The greeting.\n * @description Builds a greeting.\n */\nexport function greet(name: string): string { return name; }\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/jsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
