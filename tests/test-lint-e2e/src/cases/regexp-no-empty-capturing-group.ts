/**
 * Verifies regexp/no-empty-capturing-group: capturing groups with no content.
 *
 * Pins the branch that flags `/()/`. An empty capturing group always matches
 * the empty string and only wastes a capture slot — it is never what the
 * author intended.
 *
 * 1. Declare a regex literal with an empty `()` capturing group.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-empty-capturing-group error
const emptyCap = /()/;

JSON.stringify(emptyCap);
