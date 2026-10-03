/**
 * Verifies jsx-a11y/aria-unsupported-elements: certain tags reject ARIA.
 *
 * Pins the "unsupported host element" branch — `<meta>` is reserved
 * head metadata and the spec forbids it from carrying ARIA attributes,
 * so the rule rejects `aria-checked` placed on it.
 *
 * 1. Render a `<meta>` element with an ARIA attribute.
 * 2. Lint flags the ARIA attribute on the unsupported element.
 */
// expect: jsx-a11y/aria-unsupported-elements error
export const X = () => <meta aria-checked="true" />;
