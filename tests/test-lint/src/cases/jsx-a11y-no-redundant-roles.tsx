/**
 * Verifies jsx-a11y/no-redundant-roles: explicit role must add info.
 *
 * Pins the "duplicate native role" branch — `<button>` already has
 * the `button` role from its native semantics, so `role="button"` is
 * redundant and rejected.
 *
 * 1. Render a `<button>` with `role="button"`.
 * 2. Lint flags the redundant role attribute.
 */
// expect: jsx-a11y/no-redundant-roles error
export const X = () => <button role="button">Save</button>;
