/**
 * Verifies jsx-a11y/no-access-key: ban the `accessKey` JSX attribute.
 *
 * Pins the "accessKey set" branch — browser access keys collide with
 * assistive-technology keyboard shortcuts, so the rule rejects any
 * usage of the attribute.
 *
 * 1. Render a `<button>` with an `accessKey` attribute.
 * 2. Lint flags the prohibited access key.
 */
// expect: jsx-a11y/no-access-key error
export const X = () => <button accessKey="s">Save</button>;
