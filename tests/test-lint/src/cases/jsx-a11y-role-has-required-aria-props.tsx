/**
 * Verifies jsx-a11y/role-has-required-aria-props: required props must
 * accompany the role.
 *
 * Pins the "incomplete composite role" branch — `role="checkbox"`
 * mandates `aria-checked`; without it, assistive tech cannot report
 * the state, so the rule rejects the role declaration.
 *
 * 1. Render a `<div>` with `role="checkbox"` and no `aria-checked`.
 * 2. Lint flags the missing required ARIA prop.
 */
// expect: jsx-a11y/role-has-required-aria-props error
export const X = () => <div role="checkbox" />;
