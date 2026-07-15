/**
 * Verifies jsx-a11y/no-noninteractive-element-interactions: handlers
 * belong on interactive elements.
 *
 * Pins the "click on non-interactive" branch — a `<li>` is not
 * interactive, and adding `onClick` without an interactive role
 * confuses keyboard and screen-reader users, so the rule rejects it.
 *
 * 1. Render an `<li>` with an `onClick` and no interactive role.
 * 2. Lint flags the handler on the non-interactive element.
 */
// expect: jsx-a11y/no-noninteractive-element-interactions error
export const X = () => <li onClick={() => {}}>row</li>;
