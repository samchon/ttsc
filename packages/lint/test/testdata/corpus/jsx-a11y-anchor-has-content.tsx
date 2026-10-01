/**
 * Verifies jsx-a11y/anchor-has-content: anchors need accessible content.
 *
 * Pins the self-closing branch: an `<a />` with no text, `aria-label`, or
 * labelled child gives assistive tech nothing to announce.
 *
 * 1. Render an empty self-closing anchor with an `href` but no label.
 * 2. Lint flags the empty anchor.
 */
// expect: jsx-a11y/anchor-has-content error
export const X = () => <a href="/docs" />;
