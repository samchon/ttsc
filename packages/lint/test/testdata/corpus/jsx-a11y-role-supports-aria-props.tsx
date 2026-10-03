/**
 * Verifies jsx-a11y/role-supports-aria-props: aria props must fit the
 * role.
 *
 * Pins the "unsupported aria prop for role" branch — `role="link"`
 * does not declare `aria-checked` in its supported list, so the rule
 * rejects the combination as semantically meaningless.
 *
 * 1. Render a `<div>` with `role="link"` and `aria-checked`.
 * 2. Lint flags the aria prop that the role does not support.
 */
// expect: jsx-a11y/role-supports-aria-props error
export const X = () => <div role="link" aria-checked="true" />;
