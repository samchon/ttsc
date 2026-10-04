package linthost

import "testing"

// TestUnicornNoTypeofUndefinedFixRewritesComparisons verifies the autofix drops
// the `typeof`, strengthens loose equality, and rewrites the `"undefined"`
// literal into the `undefined` identifier — byte for byte against the authored
// oracle.
//
// The native fix uses token-scoped edits (remove `typeof` plus its trailing space,
// upgrade `==`/`!=`, replace the literal), so any off-by-one corrupts source
// silently: it would swallow a space, leave the loose operator, or mangle the
// literal. `===`/`!==` keep the operator untouched while `==`/`!=` gain the
// third `=`; an identifier operand and a member-access operand both reduce to a
// bare comparison. The expected output is an authored literal, not this
// port's own emission.
//
//  1. Lint a source stacking `===`, `!==`, `==`, and `!=` over identifier and
//     member-access operands bound in the same file.
//  2. Apply the collected fixes through the real disk-backed fix applier.
//  3. Assert the rewritten file byte for byte.
//
// @evidence contracts/testing.md#behavioral-verification assertFixSnapshot compares the complete fixed file for all four equality operators.
// @evidence contracts/testing.md#independent-expectations The independently authored output removes typeof, uses undefined and strengthens loose equality without changing declarations or operands.
// @evidence contracts/testing.md#distinguishing-cases Strict equality/inequality retain their operators, loose equality/inequality gain strictness, and member/identifier operands remain intact.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoTypeofUndefinedFixRewritesComparisons is a discoverable Go unit host; owning checker-backed engine and disk-backed fix applier operations run its literal fixtures in the shared process without installation, native builds or product children. Local table/helper failures retain the source, expected replacement or option payload identity.
func TestUnicornNoTypeofUndefinedFixRewritesComparisons(t *testing.T) {
  source := `declare const value: { deep: unknown };

typeof value === "undefined";
typeof value !== "undefined";
typeof value.deep == "undefined";
typeof value.deep != "undefined";
`
  expected := `declare const value: { deep: unknown };

value === undefined;
value !== undefined;
value.deep === undefined;
value.deep !== undefined;
`
  assertFixSnapshot(t, "unicorn/no-typeof-undefined", source, expected)
}
