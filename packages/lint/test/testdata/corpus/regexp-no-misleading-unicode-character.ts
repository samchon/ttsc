/**
 * Verifies regexp/no-misleading-unicode-character: visible grapheme is multi-code-unit.
 *
 * Pins the branch that flags character classes containing characters that
 * render as a single grapheme but span multiple UTF-16 code units, where
 * placing them in a class like `/[👍]/` quietly matches only one half of the
 * surrogate pair.
 *
 * 1. Declare a regex literal with a non-BMP character inside a class.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-misleading-unicode-character error
const unicode = /[👍]/;

JSON.stringify(unicode);
