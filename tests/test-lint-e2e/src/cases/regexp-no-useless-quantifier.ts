/**
 * Verifies regexp/no-useless-quantifier: quantifier that does not change the match.
 *
 * Pins the branch that flags quantifiers such as `/a{1}/`, which is equivalent
 * to writing `a` on its own. The redundant quantifier only adds noise and is
 * usually a leftover from refactoring a more complex pattern.
 *
 * 1. Declare a regex literal with a `{1}` quantifier.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-useless-quantifier error
const value = /a{1}/;

JSON.stringify(value);
