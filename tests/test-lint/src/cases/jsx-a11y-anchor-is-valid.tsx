/**
 * Verifies jsx-a11y/anchor-is-valid: anchors need a real href target.
 *
 * Pins the "invalid href" branch — `javascript:` URLs are treated as
 * inert links by assistive tech and break navigation semantics, so the
 * rule rejects them just like `#`-only or missing values.
 *
 * 1. Render an `<a>` whose `href` is a `javascript:` URL.
 * 2. Lint flags the invalid anchor target.
 */
// expect: jsx-a11y/anchor-is-valid error
export const X = () => <a href="javascript:void(0)">go</a>;
