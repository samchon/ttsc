package linthost

import "testing"

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
func TestFixNoExtraNonNullAssertionDropsTrailingBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-extra-non-null-assertion",
    "declare const a: number | null;\nconst x = a!!;\nJSON.stringify(x);\n",
    "declare const a: number | null;\nconst x = a!;\nJSON.stringify(x);\n",
  )
}
