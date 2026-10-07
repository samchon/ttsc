/**
 * Verifies regexp/no-dupe-characters-character-class: duplicate members in a class.
 *
 * Pins the duplicate-member check for simple character classes, where repeating
 * a literal character such as `/[aba]/` adds noise without changing the match
 * and is almost always a typo.
 *
 * 1. Declare a regex literal with the same character twice in a class.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-dupe-characters-character-class error
const duplicate = /[aba]/;

JSON.stringify(duplicate);
