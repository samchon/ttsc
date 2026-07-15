/**
 * Verifies regexp/no-useless-escape: backslash before a non-special character.
 *
 * Pins the alias branch that flags useless escapes inside regex literals, such
 * as `/\a/` where the leading backslash carries no semantic meaning and is
 * usually a typo for an intended escape sequence.
 *
 * 1. Declare a regex literal with a `\a` escape that is not a special escape.
 * 2. Assert it is flagged.
 */
// expect: regexp/no-useless-escape error
const escape = /\a/;

/**
 * Verifies regexp/no-useless-escape leaves a `v`-flag character-class escape
 * intact (issue #607).
 *
 * Under the `v` (unicodeSets) flag `(` is a ClassSetSyntaxCharacter, so `\(`
 * inside `[...]` is load-bearing; stripping it would rewrite the source to
 * `/[(]/v`, a `SyntaxError: Invalid character in character class`. No
 * diagnostic is expected on this line.
 */
const unicodeSetsClass = /[\(]/v;

/**
 * The `u`-flag twin still reports: a bare `(` in a character class is legal in
 * `u` mode, so `\(` there is a genuinely useless escape and the autofix must
 * still strip it.
 */
// expect: regexp/no-useless-escape error
const unicodeClass = /[\(]/u;

JSON.stringify([escape, unicodeSetsClass, unicodeClass]);
