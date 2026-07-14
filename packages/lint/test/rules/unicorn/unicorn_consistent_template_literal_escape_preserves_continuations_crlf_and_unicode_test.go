package linthost

import (
  "strings"
  "testing"
)

// TestUnicornConsistentTemplateLiteralEscapePreservesContinuationsCRLFAndUnicode
// verifies the raw payload rewrite across line continuations, CRLF line
// endings, and multibyte text.
//
// A backslash line continuation ends its backslash run at the line
// terminator, so a `$\{` right after `\<CRLF>` must still canonicalize
// (the upstream lookbehind sees the newline as a non-backslash). The
// rewrite must also keep the continuation, the CRLF bytes, and multibyte
// neighbors byte-identical because the edit replaces the whole payload.
//
//  1. Fix a CRLF source whose template holds a line continuation and
//     multibyte text around two bad escapes.
//  2. Compare the rewritten file byte-for-byte and assert CRLF survived.
//  3. Assert the fixed source no longer fires.
func TestUnicornConsistentTemplateLiteralEscapePreservesContinuationsCRLFAndUnicode(t *testing.T) {
  source := "const s = `line \\\r\n$\\{next} 한글 \U0001f642$\\{글}`;\r\n"
  expected := "const s = `line \\\r\n\\${next} 한글 \U0001f642\\${글}`;\r\n"

  assertFixSnapshot(t, unicornConsistentTemplateLiteralEscapeRuleName, source, expected)
  if !strings.Contains(expected, "\\\r\n\\${next}") {
    t.Fatal("oracle must keep the line continuation and CRLF before the canonical escape")
  }
  file := parseTSFile(t, "/virtual/fixed-template-literal-escape-crlf.ts", expected)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("fixed source has parse diagnostics: %+v\n%s", diagnostics, expected)
  }
  assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, expected)
}
