/**
 * Verifies jsx-a11y/label-has-for: deprecated `htmlFor`/nesting check.
 *
 * Pins the legacy "label not bound" branch — this rule predates
 * `label-has-associated-control` but still asserts the same nesting
 * or `htmlFor` association, so a free-floating `<label>` triggers it.
 *
 * 1. Render a `<label>` with no `htmlFor` and no wrapped control.
 * 2. Lint flags the missing association under the legacy rule.
 */
// expect: jsx-a11y/label-has-for error
export const X = () => <label>Email</label>;
