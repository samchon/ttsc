/**
 * Verifies regexp/sort-flags: flags must appear in canonical alphabetical order.
 *
 * Pins the branch that flags out-of-order flag sequences such as `/a/mi`. The
 * canonical `dgimsuvy` order keeps reviews diff-stable and makes it easy to
 * spot a flag at a glance.
 *
 * 1. Declare a regex literal with flags in the wrong order (`mi` instead of `im`).
 * 2. Assert it is flagged.
 */
// expect: regexp/sort-flags error
const value = /a/mi;

JSON.stringify(value);
