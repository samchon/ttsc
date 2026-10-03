/**
 * Verifies regexp/no-empty-group: non-capturing groups with no content.
 *
 * Pins the branch that flags `/(?:)/`. An empty non-capturing group is
 * structurally meaningless and almost always signals an incomplete edit.
 *
 * 1. Declare a regex literal with an empty `(?:)` group.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-empty-group error
const emptyGroup = /(?:)/;

JSON.stringify(emptyGroup);
