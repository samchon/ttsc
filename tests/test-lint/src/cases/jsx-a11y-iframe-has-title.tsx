/**
 * Verifies jsx-a11y/iframe-has-title: every `<iframe>` needs a title.
 *
 * Pins the "untitled iframe" branch — without a `title`, assistive
 * tech has no way to announce what an embedded document is, so the
 * rule rejects an `<iframe>` with no title attribute.
 *
 * 1. Render an `<iframe>` with `src` but no `title`.
 * 2. Lint flags the missing iframe title.
 */
// expect: jsx-a11y/iframe-has-title error
export const X = () => <iframe src="/embed" />;
