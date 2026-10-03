/**
 * Verifies regexp/prefer-plus-quantifier: `{1,}` collapses to `+`.
 *
 * Pins the branch that flags `{1,}` in favor of the equivalent `+` quantifier.
 * The shorter form is idiomatic and reads more cleanly without changing match
 * semantics.
 *
 * 1. Declare a regex literal that uses `{1,}` instead of `+`.
 * 2. Assert it is flagged.
 */
// expect: regexp/prefer-plus-quantifier error
const value = /a{1,}/;

JSON.stringify(value);
