package linthost

import "testing"

// TestFormatQuotesSwitchesSingleToDoubleToMinimizeEscapes verifies the
// symmetric escape-minimizing flip under prefer:"single": a
// single-quoted literal that would be strictly cheaper double is
// rewritten to double even though single is preferred.
//
// `'\”` carries one escape as single (the `\'`) and zero as double
// (`"'"`). Minimizing escapes wins over the preference, so the literal
// flips to double; on a tie it would have stayed single.
//
//  1. Parse a source file with an escaped single-quoted literal.
//  2. Apply the rule configured prefer:"single".
//  3. Assert it is rewritten to the zero-escape double-quoted form.
func TestFormatQuotesSwitchesSingleToDoubleToMinimizeEscapes(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quotes",
    `const s = '\'';`+"\n",
    `{"prefer":"single"}`,
    `const s = "'";`+"\n",
  )
}
