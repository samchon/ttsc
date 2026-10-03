/**
 * Verifies jsx-a11y/no-aria-hidden-on-focusable: hidden controls cannot
 * be focusable.
 *
 * Pins the "focusable but hidden" branch — `aria-hidden` removes an
 * element from the accessibility tree, but a `<button>` is focusable
 * by default, so focus would land on a node screen readers ignore.
 *
 * 1. Render a `<button>` with `aria-hidden`.
 * 2. Lint flags the focusable hidden element.
 */
// expect: jsx-a11y/no-aria-hidden-on-focusable error
export const X = () => <button aria-hidden="true">Save</button>;
