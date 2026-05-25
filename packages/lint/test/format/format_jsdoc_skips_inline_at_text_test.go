package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocSkipsInlineAtText verifies the rule does not
// rewrite `@`-prefixed words that are part of prose.
//
// Prose like `Email me at @return-handler@example.com` should never have
// the `@return` token rewritten. The rule's guard is "the `@` must be
// preceded by whitespace or `*`" — a prose `@` after letters or digits is
// not a JSDoc tag. Pinning the negative branch keeps the rule from
// silently mangling email addresses or Twitter handles in JSDoc text.
//
// 1. Parse a source file with an inline `@return` inside prose.
// 2. Run the engine with formatJsdoc enabled.
// 3. Assert zero findings.
func TestFormatJSDocSkipsInlineAtText(t *testing.T) {
  source := "/**\n * Mailto: user@return-handler@example.com\n */\nexport const x = 1;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/jsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
}
