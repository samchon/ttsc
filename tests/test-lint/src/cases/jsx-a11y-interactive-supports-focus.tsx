/**
 * Verifies jsx-a11y/interactive-supports-focus: interactive ARIA roles
 * must be focusable.
 *
 * Pins the "non-focusable interactive role" branch — `role="button"`
 * advertises interactivity, but a bare `<div>` is not tab-reachable
 * without `tabIndex`, so the rule rejects the combination.
 *
 * 1. Render a `<div>` with `role="button"` and a click handler but no
 *    `tabIndex`.
 * 2. Lint flags the missing focusability.
 */
// expect: jsx-a11y/interactive-supports-focus error
export const X = () => <div role="button" onClick={() => {}} />;
