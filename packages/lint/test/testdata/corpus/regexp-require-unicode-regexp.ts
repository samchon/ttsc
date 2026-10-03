/**
 * Verifies regexp/require-unicode-regexp: literal missing the `u` or `v` flag.
 *
 * Pins the branch that flags regex literals without the `u` (or `v`) flag.
 * Unicode-mode regexes parse escapes and surrogate pairs correctly and avoid
 * a long tail of legacy-mode footguns.
 *
 * 1. Declare a regex literal with no Unicode flag.
 * 2. Assert it is flagged.
 */
// expect: regexp/require-unicode-regexp error
const value = /a/;

JSON.stringify(value);
