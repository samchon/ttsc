/**
 * Verifies jsx-a11y/no-noninteractive-tabindex: only interactive
 * elements deserve `tabIndex`.
 *
 * Pins the "tabindex on non-interactive" branch — adding `tabIndex`
 * to a `<div>` with no interactive role inserts a confusing focus
 * stop that announces nothing actionable, so the rule rejects it.
 *
 * 1. Render a `<div>` with `tabIndex={0}` and no interactive role.
 * 2. Lint flags the tabindex on a non-interactive element.
 */
// expect: jsx-a11y/no-noninteractive-tabindex error
export const X = () => <div tabIndex={0} />;
