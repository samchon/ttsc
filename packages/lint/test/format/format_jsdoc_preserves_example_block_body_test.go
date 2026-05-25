package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocPreservesExampleBlockBody verifies the rule does not
// rewrite tag synonyms inside an `@example` block.
//
// `@example` is JSDoc's "here is some sample code" tag — its body is
// free-form code that often quotes JSDoc itself, including the
// synonyms (`@arg`, `@return`) the rule normally rewrites. A regression
// that rewrote them inside the example would corrupt the documented
// sample. The rule fast-forwards past the example body to the next
// top-level `@` at line start.
//
//  1. Parse a JSDoc block containing one synonym outside `@example`
//     (must be rewritten) and one synonym inside (must be preserved).
//  2. Run formatJsdoc.
//  3. Assert exactly one finding — the synonym outside the example.
func TestFormatJSDocPreservesExampleBlockBody(t *testing.T) {
  source := "/**\n" +
    " * Outer description.\n" +
    " * @return {number} the outer doc that gets rewritten\n" +
    " * @example\n" +
    " * function demo() {\n" +
    " *   // @return inside example body — should NOT be rewritten\n" +
    " * }\n" +
    " * @description trailing canonical tag closes the example\n" +
    " */\n" +
    "export const value = 1;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"formatJsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected 1 finding (only the outer @return → @returns), got %d:\n%v",
      len(findings), findings)
  }
}
