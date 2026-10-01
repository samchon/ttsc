/**
 * Verifies jsx-a11y/tabindex-no-positive: only `0` or `-1` are allowed.
 *
 * Pins the "positive tabindex" branch — anything greater than `0`
 * jumps the keyboard focus order out of document order and almost
 * always desynchronizes from later DOM changes, so the rule rejects it.
 *
 * 1. Render a `<button>` with `tabIndex={1}`.
 * 2. Lint flags the positive tabindex value.
 */
// expect: jsx-a11y/tabindex-no-positive error
export const X = () => <button tabIndex={1}>Save</button>;
