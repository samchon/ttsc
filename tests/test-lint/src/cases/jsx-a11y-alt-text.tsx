/**
 * Verifies jsx-a11y/alt-text: image-like elements must expose alt text.
 *
 * Pins the "image without text alternative" branch — screen readers
 * announce nothing when `<img>` is missing both `alt` and an ARIA label,
 * so the rule rejects the bare tag.
 *
 * 1. Render an `<img>` with only a `src`, no `alt` and no `aria-label`.
 * 2. Lint flags it as a missing text-alternative.
 */
// expect: jsx-a11y/alt-text error
export const X = () => <img src="/logo.png" />;
