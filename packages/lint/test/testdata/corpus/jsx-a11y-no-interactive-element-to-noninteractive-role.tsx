/**
 * Verifies jsx-a11y/no-interactive-element-to-noninteractive-role:
 * native interactive tags must keep an interactive role.
 *
 * Pins the "downgrade" branch — `<button role="presentation">` strips
 * the button's interactive semantics while keeping its behavior,
 * which confuses assistive tech, so the rule rejects the override.
 *
 * 1. Render a `<button>` with `role="presentation"`.
 * 2. Lint flags the downgrade to a non-interactive role.
 */
// expect: jsx-a11y/no-interactive-element-to-noninteractive-role error
export const X = () => <button role="presentation">Save</button>;
