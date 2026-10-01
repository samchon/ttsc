/**
 * Verifies regexp/no-empty-lookarounds-assertion: empty lookaround assertions.
 *
 * Pins the branch that flags assertions like `/(?=)/` or `/(?!)/` where the
 * inner pattern is empty. An empty lookahead always succeeds and an empty
 * negative-lookahead always fails — both are tautological and almost certainly
 * an editing mistake.
 *
 * 1. Declare a regex literal with an empty positive-lookahead.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-empty-lookarounds-assertion error
const emptyLook = /(?=)/;

JSON.stringify(emptyLook);
