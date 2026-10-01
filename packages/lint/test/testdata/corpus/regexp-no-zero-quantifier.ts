/**
 * Verifies regexp/no-zero-quantifier: `{0}` repetition matches nothing.
 *
 * Pins the branch that flags zero-repeat quantifiers like `/a{0}/` or
 * `/a{0,0}/`. The quantified atom can never contribute to the match, so the
 * quantifier is dead code and is almost certainly a mistake.
 *
 * 1. Declare a regex literal with a `{0}` quantifier.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-zero-quantifier error
const value = /a{0}/;

JSON.stringify(value);
