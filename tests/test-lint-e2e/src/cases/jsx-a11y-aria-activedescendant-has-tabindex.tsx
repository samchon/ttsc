/**
 * Verifies jsx-a11y/aria-activedescendant-has-tabindex: composite hosts
 * carrying `aria-activedescendant` must be focusable.
 *
 * Pins the "non-focusable host" branch — a `<div>` is not focusable by
 * default, so `aria-activedescendant` cannot do anything without an
 * explicit `tabIndex` keeping document focus on the host.
 *
 * 1. Render a `<div>` with `aria-activedescendant` and no `tabIndex`.
 * 2. Lint flags the missing tabindex on the composite host.
 */
// expect: jsx-a11y/aria-activedescendant-has-tabindex error
export const X = () => <div aria-activedescendant="opt-1" />;
