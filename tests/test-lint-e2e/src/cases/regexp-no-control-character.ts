/**
 * Verifies regexp/no-control-character: control bytes embedded in regex literals.
 *
 * Pins the source-text branch that flags `\x00`-`\x1F` escapes inside a regex
 * literal. Control characters in patterns are almost always typos or copy-paste
 * artifacts and should be rejected rather than silently matched.
 *
 * 1. Declare a regex literal with a `\x1f` control-character escape.
 * 2. Assert it is flagged under the namespaced `regexp/*` alias.
 */
// expect: regexp/no-control-character error
const control = /\x1f/;

JSON.stringify(control);
