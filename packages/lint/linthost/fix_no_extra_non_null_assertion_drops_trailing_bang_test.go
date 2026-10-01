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
//
// @evidence contracts/testing.md#behavioral-verification typescript/no-extra-non-null-assertion deletes only the outer bang from a!! and leaves a! intact.
// @evidence contracts/testing.md#independent-expectations The authored one-bang result preserves the declaration and trailing use; deleting both bangs would fail exact source equality.
// @evidence contracts/testing.md#distinguishing-cases Nested non-null assertions are the redundant positive arm; this case does not assert the type-checker meaning of nullable a.
// @evidence contracts/testing.md#execution-ownership TestFixNoExtraNonNullAssertionDropsTrailingBang invokes assertFixSnapshot with the actual named Engine rule and disk-backed edit application.
func TestFixNoExtraNonNullAssertionDropsTrailingBang(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-extra-non-null-assertion",
    "declare const a: number | null;\nconst x = a!!;\nJSON.stringify(x);\n",
    "declare const a: number | null;\nconst x = a!;\nJSON.stringify(x);\n",
  )
}
