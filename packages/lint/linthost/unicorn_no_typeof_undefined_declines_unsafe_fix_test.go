package linthost

import "testing"

// TestUnicornNoTypeofUndefinedDeclinesUnsafeFix verifies the rule still reports
// the ASI-hazard shapes but attaches no autofix, so the fix applier leaves the
// source untouched.
//
// Removing the leading `typeof` can trigger Automatic Semicolon Insertion. An
// operand that begins with a continuation character (`typeof [x] === …` after a
// prior expression parses as `x[…]`) and an operand split onto a different line
// from `typeof` (which would let `return` insert a semicolon before it) are the
// two cases where a naive edit corrupts source. Upstream fixes them by inserting
// a guarding `;` or wrapping parentheses; this port declines the edit instead,
// so the diagnostic must still fire while the file stays byte-identical. The
// safe twin — an identifier operand on the same line — is the fix-rewrites case.
//
//  1. Lint a source stacking an array-literal operand and a line-split operand,
//     both bound so the global guard does not pre-empt the report.
//  2. Run the disk-backed fix applier.
//  3. Assert findings exist but nothing was rewritten.
//
// @evidence contracts/testing.md#behavioral-verification assertNoFixSnapshot requires diagnostics but no applied edits and unchanged source for ASI-sensitive operands.
// @evidence contracts/testing.md#independent-expectations The original authored source is the no-edit oracle under the supported conservative fix policy.
// @evidence contracts/testing.md#distinguishing-cases An array-leading operand and a typeof/operand line split both withhold fixes; safe identifier/member comparison rewrites belong to TestUnicornNoTypeofUndefinedFixRewritesComparisons.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoTypeofUndefinedDeclinesUnsafeFix is a discoverable Go unit host; owning checker-backed engine and disk-backed fix applier operations run its literal fixtures in the shared process without installation, native builds or product children. Local table/helper failures retain the source, expected replacement or option payload identity.
func TestUnicornNoTypeofUndefinedDeclinesUnsafeFix(t *testing.T) {
  source := `declare const items: unknown[];
declare const value: { deep: unknown };

typeof [items] === "undefined";
typeof
value.deep === "undefined";
`
  assertNoFixSnapshot(t, "unicorn/no-typeof-undefined", source)
}
