package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatJSDocSkipsInlineAtText verifies the rule does not
// rewrite `@`-prefixed words that are part of prose.
//
// In `user@return-handler@example.com`, each at sign follows letters
// rather than a tag-opening boundary. Preserving these bytes while a real
// neighboring return tag changes distinguishes prose from a block tag.
//
// 1. Parse email-like prose alone and beside a real return-tag block.
// 2. Run the engine with formatJsdoc enabled.
// 3. Assert no findings for prose alone and only the real tag changes.
//
// @evidence contracts/testing.md#behavioral-verification The owning JSDoc rule must preserve both at-sign sequences inside the email-like prose while normalizing an adjacent real return tag. The original no-finding assertion remains, and full paired output distinguishes excluding prose from skipping every comment.
// @evidence contracts/testing.md#independent-expectations The literal user@return-handler@example.com is authored description text, so its bytes must remain intact. The supported canonical return spelling independently determines the sole adjacent returns change.
// @evidence contracts/testing.md#distinguishing-cases The original email-only negative has at signs preceded by letters. Adding a separate real return-tag block supplies a neighboring positive; this host does not claim every whitespace-preceded at sign inside prose is recognized correctly.
// @evidence contracts/testing.md#execution-ownership TestFormatJSDocSkipsInlineAtText owns the original direct Engine no-finding assertion and paired source/output in the public Go unit population. The owning rule and edit harness run in process without consumer installation, native artifact building or a real product host.
func TestFormatJSDocSkipsInlineAtText(t *testing.T) {
  source := "/**\n * Mailto: user@return-handler@example.com\n */\nexport const x = 1;\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{"format/jsdoc": SeverityError}).
    Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("expected zero findings, got %d: %+v", len(findings), findings)
  }
  assertFixSnapshot(t, "format/jsdoc", "/** @return number */\n"+source,
    "/** @returns number */\n"+source)
}
