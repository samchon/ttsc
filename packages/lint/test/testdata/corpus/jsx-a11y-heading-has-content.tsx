/**
 * Verifies jsx-a11y/heading-has-content: heading tags need announcable content.
 *
 * Pins the self-closing branch: assistive tech cannot announce a heading with
 * no children or accessible label.
 *
 * 1. Render an empty self-closing `<h1 />` element.
 * 2. Lint flags the empty heading.
 */
// expect: jsx-a11y/heading-has-content error
export const X = () => <h1 />;
