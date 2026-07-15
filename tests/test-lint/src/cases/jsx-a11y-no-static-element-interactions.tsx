/**
 * Verifies jsx-a11y/no-static-element-interactions: static elements
 * with interaction handlers need an interactive role.
 *
 * Pins the "static click target" branch: a `<div>` carrying `onClick` looks
 * interactive at runtime but has no role for assistive tech to announce, so the
 * rule requires an explicit role.
 *
 * 1. Render a `<div>` with `onClick` and no role.
 * 2. Lint flags the static element with an interaction.
 */
// expect: jsx-a11y/no-static-element-interactions error
export const X = () => <div onClick={() => {}}>open</div>;
