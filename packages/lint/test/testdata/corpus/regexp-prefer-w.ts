/**
 * Verifies regexp/prefer-w: word-character class collapses to `\w`.
 *
 * Pins the branch that flags `[A-Za-z0-9_]` and similar exhaustive word
 * classes in favor of the `\w` shorthand, which is shorter and idiomatic.
 *
 * 1. Declare a regex literal that spells out `[A-Za-z0-9_]` rather than `\w`.
 * 2. Assert it is flagged.
 */
// expect: regexp/prefer-w error
const word = /[A-Za-z0-9_]/;

JSON.stringify(word);
