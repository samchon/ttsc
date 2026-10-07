/**
 * Verifies regexp/no-useless-two-nums-quantifier: `{n,n}` reduces to `{n}`.
 *
 * Pins the branch that flags two-number quantifiers whose min and max are
 * equal, like `/a{2,2}/`. The shorter `/a{2}/` form has identical semantics
 * and reads more clearly.
 *
 * 1. Declare a regex literal with `{n,n}` where min and max are equal.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-useless-two-nums-quantifier error
const value = /a{2,2}/;

JSON.stringify(value);
