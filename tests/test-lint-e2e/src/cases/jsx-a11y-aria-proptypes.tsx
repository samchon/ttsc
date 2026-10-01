/**
 * Verifies jsx-a11y/aria-proptypes: literal ARIA values must match the
 * declared type.
 *
 * Pins the "wrong value type" branch — `aria-hidden` is a boolean in
 * the spec, so the string `"yes"` is not a valid value and the rule
 * rejects it.
 *
 * 1. Render a `<div>` with `aria-hidden="yes"`.
 * 2. Lint flags the value as wrong for the declared boolean type.
 */
// expect: jsx-a11y/aria-proptypes error
export const X = () => <div aria-hidden="yes" />;
