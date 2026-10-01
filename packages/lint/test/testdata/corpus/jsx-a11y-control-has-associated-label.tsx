/**
 * Verifies jsx-a11y/control-has-associated-label: interactive controls
 * must have an accessible label.
 *
 * Pins the "unlabelled control" branch — a `<button>` with no text,
 * no `aria-label`, and no `aria-labelledby` has nothing for assistive
 * tech to announce, so the rule rejects it.
 *
 * 1. Render an empty `<button>` with no labelling attribute.
 * 2. Lint flags the missing accessible label.
 */
// expect: jsx-a11y/control-has-associated-label error
export const X = () => <button />;
