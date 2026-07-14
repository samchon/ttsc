/**
 * Verifies regexp/no-empty-character-class: empty `[]` class never matches.
 *
 * Pins the alias branch that flags `/[]/`. An empty character class matches
 * nothing, so the surrounding pattern can never succeed and the literal is
 * almost certainly a mistake.
 *
 * 1. Declare a regex literal with an empty character class.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-empty-character-class error
const empty = /[]/;

JSON.stringify(empty);

const anyLegacyCharacter = /[^]/;
const escapedBrackets = /[\[\]]/;
const range = /[a-z]/;

// expect: regexp/no-empty-character-class error
const unicodeEmpty = /[]/u;
const anyUnicodeCharacter = /[^]/u;

// expect: regexp/no-empty-character-class error
const unicodeSetsEmpty = /[]/v;
const anyUnicodeSetsCharacter = /[^]/v;

// expect: regexp/no-empty-character-class error
const nestedUnicodeSetsEmpty = /[[]]/v;
const nestedUnicodeSetsAny = /[[^]]/v;
const nestedUnicodeSetsNonEmpty = /[[a-z]]/v;
const escapedUnicodeSetsBrackets = /[\[\]]/v;
