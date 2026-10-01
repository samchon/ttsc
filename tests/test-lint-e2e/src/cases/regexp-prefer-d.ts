/**
 * Verifies regexp/prefer-d: digit class collapses to `\d`.
 *
 * Pins the branch that flags `[0-9]` and similar full-digit classes in favor
 * of the `\d` shorthand, which is shorter, idiomatic, and consistent with the
 * other shorthand-class rules in this family.
 *
 * 1. Declare a regex literal that spells out `[0-9]` rather than `\d`.
 * 2. Assert it is flagged.
 */
// expect: regexp/prefer-d error
const digit = /[0-9]/;

JSON.stringify(digit);
