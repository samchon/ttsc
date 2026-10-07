/**
 * Verifies jsx-a11y/mouse-events-have-key-events: mouse over/out need
 * focus/blur parity.
 *
 * Pins the "pointer-only hover" branch — `onMouseOver` reacts only to
 * mouse pointers, leaving keyboard users without the same interaction,
 * so the rule requires a matching `onFocus` handler.
 *
 * 1. Render a `<div>` with `onMouseOver` and no `onFocus`.
 * 2. Lint flags the missing focus counterpart.
 */
// expect: jsx-a11y/mouse-events-have-key-events error
export const X = () => <div onMouseOver={() => {}} />;
