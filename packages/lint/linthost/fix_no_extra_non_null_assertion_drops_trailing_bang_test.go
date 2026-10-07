package linthost

import (
  "strings"
  "testing"
)

// TestFixNoExtraNonNullAssertionDropsTrailingBang verifies the
// noExtraNonNullAssertion fixer collapses `a!!` to `a!`.
//
// The redundant `!` lives at the end of the outer NonNullExpression's
// range. The fixer must delete exactly that one byte so the inner
// assertion remains intact.
//
// 1. Parse a source file containing `a!!`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the trailing `!` is gone and the rest is unchanged.
//
// @evidence contracts/testing.md#behavioral-verification typescript/no-extra-non-null-assertion deletes only the outer bang from a!! and leaves a! intact.
// @evidence contracts/testing.md#independent-expectations The authored one-bang result preserves the declaration and trailing use; the literal a!! span independently locates the final bang so deleting the identical inner bang cannot satisfy the edit-range assertion.
// @evidence contracts/testing.md#distinguishing-cases Nested non-null assertions are the redundant positive arm; this case does not assert the type-checker meaning of nullable a.
// @evidence contracts/testing.md#execution-ownership TestFixNoExtraNonNullAssertionDropsTrailingBang invokes assertFixSnapshot with the actual named Engine rule and disk-backed edit application.
func TestFixNoExtraNonNullAssertionDropsTrailingBang(t *testing.T) {
  source := "declare const a: number | null;\nconst x = a!!;\nJSON.stringify(x);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "typescript/no-extra-non-null-assertion", source, nil)
  if len(findings) != 1 || len(findings[0].Fix) != 1 {
    t.Fatalf("want one redundant assertion with one edit, got %+v", findings)
  }
  lastBang := strings.Index(source, "a!!") + 2
  if edit := findings[0].Fix[0]; edit.Pos != lastBang || edit.End != lastBang+1 || edit.Text != "" {
    t.Fatalf("want deletion of the final bang at [%d,%d), got %+v", lastBang, lastBang+1, edit)
  }
  assertFixSnapshot(
    t,
    "typescript/no-extra-non-null-assertion",
    source,
    "declare const a: number | null;\nconst x = a!;\nJSON.stringify(x);\n",
  )
}
