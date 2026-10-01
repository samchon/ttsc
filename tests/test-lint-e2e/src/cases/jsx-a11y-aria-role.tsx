/**
 * Verifies jsx-a11y/aria-role: roles must be concrete, non-abstract.
 *
 * Pins the "abstract role" branch — `"range"` is an abstract role in
 * the WAI-ARIA spec and is never valid on real elements, so the rule
 * rejects it alongside misspellings.
 *
 * 1. Render a `<div>` with `role="range"`.
 * 2. Lint flags the abstract role assignment.
 */
// expect: jsx-a11y/aria-role error
export const X = () => <div role="range" />;
