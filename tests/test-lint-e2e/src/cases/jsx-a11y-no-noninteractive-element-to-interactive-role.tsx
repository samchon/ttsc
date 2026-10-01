/**
 * Verifies jsx-a11y/no-noninteractive-element-to-interactive-role:
 * use a matching interactive tag instead of an overridden role.
 *
 * Pins the "upgrade via role" branch — `<li role="button">` claims
 * interactivity the `<li>` element does not natively provide; the
 * rule rejects the override and points at the real `<button>` tag.
 *
 * 1. Render an `<li>` with `role="button"`.
 * 2. Lint flags the upgrade to an interactive role.
 */
// expect: jsx-a11y/no-noninteractive-element-to-interactive-role error
export const X = () => <li role="button">click</li>;
