package linthost

import "testing"

// TestUnicornConsistentExistenceIndexCheckFixRewritesMagnitudeComparisons
// verifies the autofix rewrites each magnitude comparison into the sentinel
// form without disturbing anything else on the line.
//
// The fix is two token-scoped edits (operator, then right operand), so any
// off-by-one corrupts source silently: it would swallow a paren, an interior
// comment, or the newline of a wrapped comparison. `> -1` is the asymmetric
// arm — its right operand already spells the sentinel, so upstream edits only
// the operator and the fix must not rewrite `-1` into `-1` (or worse, into the
// literal's paren-stripped range). The expected output is the upstream oracle's
// fixed source, not this port's own emission.
//
//  1. Lint a source stacking `< 0`, `>= 0`, `> -1`, a parenthesized literal,
//     an interior comment, and a comparison split across lines.
//  2. Apply the collected fixes through the real disk-backed fix applier.
//  3. Assert the rewritten file byte for byte.
func TestUnicornConsistentExistenceIndexCheckFixRewritesMagnitudeComparisons(t *testing.T) {
  source := `declare const array: number[];

const plain = array.indexOf(1);
void (plain < 0);

const atLeast = array.indexOf(2);
void (atLeast >= 0);

const above = array.indexOf(3);
void (above > -1);

const commented = array.indexOf(4);
void (commented /* keep */ < /* keep */ 0);

const wrapped = array.indexOf(5);
void (wrapped < (0));

const split = array.indexOf(6);
void (
  split
    >= 0
);
`
  expected := `declare const array: number[];

const plain = array.indexOf(1);
void (plain === -1);

const atLeast = array.indexOf(2);
void (atLeast !== -1);

const above = array.indexOf(3);
void (above !== -1);

const commented = array.indexOf(4);
void (commented /* keep */ === /* keep */ -1);

const wrapped = array.indexOf(5);
void (wrapped === (-1));

const split = array.indexOf(6);
void (
  split
    !== -1
);
`
  assertFixSnapshot(t, "unicorn/consistent-existence-index-check", source, expected)
}
