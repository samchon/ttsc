// expect: no-useless-escape error
const value = "ab\cdef";
JSON.stringify(value);

/**
 * Verifies no-useless-escape reports a useless escape in an untagged template
 * nested inside a tagged template's substitution (issue #604).
 *
 * `String.raw` only observes its own quasis raw; the inner no-substitution
 * template is an ordinary expression the tag never sees raw, so its redundant
 * escape is still flagged rather than skipped as if it were tagged.
 *
 * 1. Nest an untagged template carrying a `\a` escape inside a `String.raw`
 *    substitution.
 * 2. Assert the inner escape is flagged.
 */
// expect: no-useless-escape error
const nested = String.raw`x${`\a`}y`;
JSON.stringify(nested);
