package linthost

import (
  "strings"
  "testing"
)

// TestUnicornBetterRegexReportsExactRangeAndMessage verifies the diagnostic
// spans exactly the regex-literal token and carries the upstream message and a
// single token-wide autofix edit.
//
// Upstream reports the Literal node and its message interpolates the raw and
// optimized literals: `/[0-9]/ can be optimized to /\d/.`. An off-by-one on
// either end of the range or edit would corrupt the surrounding declaration,
// so the token bounds and the replacement text are pinned exactly.
//
//  1. Lint one optimizable literal.
//  2. Assert a single finding at the literal token with the exact message.
//  3. Assert the fix is one edit spanning the token with the canonical text.
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshot verifies the digit-class message, one literal-wide diagnostic and one literal-wide replacement edit.
// @evidence contracts/testing.md#independent-expectations The authored token [0-9], independently located byte bounds and literal /\d/ replacement specify the upstream shorthand contract rather than reading rule-computed ranges.
// @evidence contracts/testing.md#distinguishing-cases The declaration prefix and semicolon are outside the exact diagnostic/edit range; canonical no-report forms are owned by TestUnicornBetterRegexLeavesOptimalLiterals.
// @evidence contracts/testing.md#execution-ownership This named Go unit entry exercises the owning lint engine with a virtual AST; the shared Go process runs owning operations without installing a consumer, building a native artifact or launching a product host.
func TestUnicornBetterRegexReportsExactRangeAndMessage(t *testing.T) {
  source := "const foo = /[0-9]/;\n"
  token := "/[0-9]/"
  start := strings.Index(source, token)
  if start < 0 {
    t.Fatalf("token %q missing from source", token)
  }
  end := start + len(token)

  _, _, findings := runRuleFindingsSnapshot(t, unicornBetterRegexRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("want 1 finding, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if finding.Message != "/[0-9]/ can be optimized to /\\d/." {
    t.Fatalf("message: got %q", finding.Message)
  }
  if finding.Pos != start || finding.End != end {
    t.Fatalf("range: want [%d,%d), got [%d,%d)", start, end, finding.Pos, finding.End)
  }
  if len(finding.Fix) != 1 {
    t.Fatalf("want exactly one edit, got %+v", finding.Fix)
  }
  edit := finding.Fix[0]
  if edit.Pos != start || edit.End != end || edit.Text != "/\\d/" {
    t.Fatalf("edit: want [%d,%d)=%q, got [%d,%d)=%q", start, end, "/\\d/", edit.Pos, edit.End, edit.Text)
  }
}
