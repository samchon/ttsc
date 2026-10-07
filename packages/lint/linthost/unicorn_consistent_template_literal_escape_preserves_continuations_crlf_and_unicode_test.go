package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapePreservesContinuationsCRLFAndUnicode
// verifies the raw payload rewrite across line continuations, CRLF line
// endings, and multibyte text.
//
// A backslash line continuation ends its backslash run at the line
// terminator, so a `$\{` right after `\<CRLF>` must still canonicalize
// (the owning byte scanner resets its run on the line terminator). The
// rewrite must also keep the continuation, the CRLF bytes, and multibyte
// neighbors byte-identical because the edit replaces the whole payload.
//
//  1. Fix a CRLF source whose template holds a line continuation and
//     multibyte text around two bad escapes.
//  2. Compare the rewritten file byte-for-byte and assert CRLF survived.
//  3. Assert the fixed source no longer fires.
//
// @evidence contracts/testing.md#behavioral-verification whole-source fix equality preserves line continuation, CRLF and multibyte neighbors while canonicalizing two escapes; parsing and re-lint remain clean.
// @evidence contracts/testing.md#independent-expectations The literal expected bytes independently retain CRLF, Korean and astral characters instead of normalizing them through the product helper.
// @evidence contracts/testing.md#distinguishing-cases Malformed escapes after a backslash-CRLF continuation and beside multibyte text change; all surrounding bytes and the canonical result remain intact.
// @evidence contracts/testing.md#execution-ownership This Go unit exercises owning fix/parser operations in one shared process; line-ending bytes are fixture inputs rather than an OS matrix. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
func TestUnicornConsistentTemplateLiteralEscapePreservesContinuationsCRLFAndUnicode(t *testing.T) {
  source := "const s = `line \\\r\n$\\{next} 한글 \U0001f642$\\{글}`;\r\n"
  expected := "const s = `line \\\r\n\\${next} 한글 \U0001f642\\${글}`;\r\n"

  assertFixSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, source, expected)
  file := parseTSFile(t, "/virtual/fixed-template-literal-escape-crlf.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, expected)
}
