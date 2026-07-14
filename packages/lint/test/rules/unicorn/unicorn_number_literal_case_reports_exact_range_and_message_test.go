package linthost

import (
  "strings"
  "testing"
)

// TestUnicornNumberLiteralCaseReportsExactRangeAndMessage verifies the
// diagnostic spans exactly the literal token, names both spellings, and carries
// a single token-wide autofix edit.
//
// The rule reports the literal node and its message interpolates the raw and
// canonical spellings, so a swapped pair would tell the reader to rewrite
// `1e10` into `1E10`. An off-by-one on either end of the range or the edit would
// swallow the `=` or the `;` around the literal, which a whole-file snapshot
// alone cannot localize.
//
//  1. Lint one uppercase-exponent literal.
//  2. Assert a single finding at the literal token with the exact message.
//  3. Assert the fix is one edit spanning the token with the canonical text.
func TestUnicornNumberLiteralCaseReportsExactRangeAndMessage(t *testing.T) {
  source := "const foo = 1E10;\n"
  token := "1E10"
  start := strings.Index(source, token)
  if start < 0 {
    t.Fatalf("token %q missing from source", token)
  }
  end := start + len(token)

  _, _, findings := runRuleFindingsSnapshot(t, unicornNumberLiteralCaseRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Message != "Number literal `1E10` should be written as `1e10`." {
    t.Fatalf("message: got %q", finding.Message)
  }
  if finding.Pos != start || finding.End != end {
    t.Fatalf("range: want [%d,%d), got [%d,%d)", start, end, finding.Pos, finding.End)
  }
  if len(finding.Fix) != 1 {
    t.Fatalf("want exactly one edit, got %+v", finding.Fix)
  }
  edit := finding.Fix[0]
  if edit.Pos != start || edit.End != end || edit.Text != "1e10" {
    t.Fatalf("edit: want [%d,%d)=%q, got [%d,%d)=%q", start, end, "1e10", edit.Pos, edit.End, edit.Text)
  }
}
