/**
 * Verifies jsx-a11y/prefer-tag-over-role: native tags beat aria roles.
 *
 * Pins the "div+role substitute" branch — `<div role="button">`
 * reimplements what `<button>` already does natively, and missing
 * focus/keyboard behavior comes free with the real tag, so the rule
 * rejects the substitute.
 *
 * 1. Render a `<div>` with `role="button"`.
 * 2. Lint flags the role that a native tag already covers.
 */
// expect: jsx-a11y/prefer-tag-over-role error
export const X = () => <div role="button">Save</div>;
