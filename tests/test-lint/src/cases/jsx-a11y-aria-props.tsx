/**
 * Verifies jsx-a11y/aria-props: `aria-*` names must be in the spec.
 *
 * Pins the "misspelled aria attribute" branch — `aria-labeledby`
 * (missing the second `l`) silently does nothing at runtime, so the
 * rule rejects any `aria-*` name not in the WAI-ARIA states/properties
 * vocabulary.
 *
 * 1. Render a `<div>` with a misspelled `aria-labeledby` attribute.
 * 2. Lint flags the unknown ARIA property name.
 */
// expect: jsx-a11y/aria-props error
export const X = () => <div aria-labeledby="title" />;
