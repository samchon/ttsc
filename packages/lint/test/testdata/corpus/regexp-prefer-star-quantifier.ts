/**
 * Verifies regexp/prefer-star-quantifier: `{0,}` collapses to `*`.
 *
 * Pins the branch that flags `{0,}` in favor of the equivalent `*`
 * quantifier. The shorthand is idiomatic and consistent with the rest of the
 * `prefer-*-quantifier` family.
 *
 * 1. Declare a regex literal that uses `{0,}` instead of `*`.
 * 2. Assert it is flagged.
 */
// expect: regexp/prefer-star-quantifier error
const value = /a{0,}/;

JSON.stringify(value);
