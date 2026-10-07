/**
 * Verifies jsx-a11y/scope: the `scope` attribute belongs on `<th>`.
 *
 * Pins the "scope outside th" branch — browsers ignore `scope` on
 * non-header cells, and assistive tech that understands tables gets
 * confused, so the rule rejects `scope` on any tag other than `<th>`.
 *
 * 1. Render a `<div>` with `scope="col"`.
 * 2. Lint flags the misplaced scope attribute.
 */
// expect: jsx-a11y/scope error
export const X = () => <div scope="col" />;
