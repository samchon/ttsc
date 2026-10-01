/**
 * Verifies regexp/prefer-question-quantifier: `{0,1}` collapses to `?`.
 *
 * Pins the branch that flags `{0,1}` in favor of the equivalent `?`
 * quantifier. The shorthand is idiomatic and matches the way most readers
 * scan regex literals for optional atoms.
 *
 * 1. Declare a regex literal that uses `{0,1}` instead of `?`.
 * 2. Assert it is flagged.
 */
// expect: regexp/prefer-question-quantifier error
const value = /a{0,1}/;

JSON.stringify(value);
