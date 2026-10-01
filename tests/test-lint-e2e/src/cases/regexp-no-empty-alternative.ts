/**
 * Verifies regexp/no-empty-alternative: empty branches inside a disjunction.
 *
 * Pins the branch that flags `/a||b/`, where the middle alternative matches
 * the empty string and renders the surrounding alternatives unreachable for
 * the intended semantics.
 *
 * 1. Declare a regex literal with two `|` separators and no content between them.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-empty-alternative error
const emptyAlt = /a||b/;

JSON.stringify(emptyAlt);
