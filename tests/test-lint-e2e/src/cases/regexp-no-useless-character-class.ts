/**
 * Verifies regexp/no-useless-character-class: single-member class reduces to the char.
 *
 * Pins the branch that flags `/[x]/`. A character class with a single literal
 * member adds no expressive power over writing the character directly and is
 * usually a leftover from edit history.
 *
 * 1. Declare a regex literal with a one-character `[x]` class.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-useless-character-class error
const single = /[x]/;

JSON.stringify(single);
