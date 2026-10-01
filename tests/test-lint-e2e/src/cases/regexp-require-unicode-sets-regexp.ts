/**
 * Verifies regexp/require-unicode-sets-regexp: literal missing the `v` flag.
 *
 * Pins the branch that requires the `v` flag specifically. Even with the
 * baseline `u` flag, codebases that have opted into Unicode-sets mode want
 * every literal to opt in so set notation and string-property escapes are
 * available everywhere.
 *
 * 1. Declare a regex literal that uses `u` but not `v`.
 * 2. Assert it is flagged.
 */
// expect: regexp/require-unicode-sets-regexp error
const value = /a/u;

JSON.stringify(value);
