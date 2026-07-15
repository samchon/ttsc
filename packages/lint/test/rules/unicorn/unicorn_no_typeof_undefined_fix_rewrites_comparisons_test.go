package linthost

import "testing"

// TestUnicornNoTypeofUndefinedFixRewritesComparisons verifies the autofix drops
// the `typeof`, strengthens loose equality, and rewrites the `"undefined"`
// literal into the `undefined` identifier — byte for byte against the upstream
// oracle.
//
// The fix is three token-scoped edits (remove `typeof` plus its trailing space,
// upgrade `==`/`!=`, replace the literal), so any off-by-one corrupts source
// silently: it would swallow a space, leave the loose operator, or mangle the
// literal. `===`/`!==` keep the operator untouched while `==`/`!=` gain the
// third `=`; an identifier operand and a member-access operand both reduce to a
// bare comparison. The expected output is upstream's fixed source, not this
// port's own emission.
//
//  1. Lint a source stacking `===`, `!==`, `==`, and `!=` over identifier and
//     member-access operands bound in the same file.
//  2. Apply the collected fixes through the real disk-backed fix applier.
//  3. Assert the rewritten file byte for byte.
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
