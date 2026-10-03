/**
 * Verifies jsx-a11y/label-has-associated-control: labels need a control.
 *
 * Pins the "orphan label" branch — a `<label>` that neither wraps a
 * form control nor declares `htmlFor` is not associated with anything,
 * so the rule rejects it.
 *
 * 1. Render a `<label>` with text but no `htmlFor` and no nested
 *    control.
 * 2. Lint flags the unassociated label.
 */
// expect: jsx-a11y/label-has-associated-control error
export const X = () => <label>Name</label>;
