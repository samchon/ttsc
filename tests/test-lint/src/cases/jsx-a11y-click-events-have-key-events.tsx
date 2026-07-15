/**
 * Verifies jsx-a11y/click-events-have-key-events: `onClick` on a
 * non-interactive element must be reachable by keyboard.
 *
 * Pins the "click-only handler" branch — a `<div>` is not focusable
 * and not interactive, so an `onClick` without a parallel key handler
 * is unreachable for keyboard users.
 *
 * 1. Render a `<div>` with an `onClick` and no key handler.
 * 2. Lint flags the missing keyboard counterpart.
 */
// expect: jsx-a11y/click-events-have-key-events error
export const X = () => <div onClick={() => {}} />;
