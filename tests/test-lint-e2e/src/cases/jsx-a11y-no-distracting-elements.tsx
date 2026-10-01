/**
 * Verifies jsx-a11y/no-distracting-elements: reject `<marquee>`/`<blink>`.
 *
 * Pins the "WCAG 2.2.2 motion" branch — moving content the user
 * cannot pause harms users with cognitive or visual impairments, and
 * the rule's closed list rejects `<marquee>` and `<blink>` outright.
 *
 * 1. Render a `<marquee>` element.
 * 2. Lint flags the distracting element.
 */
// expect: jsx-a11y/no-distracting-elements error
export const X = () => <marquee>scroll</marquee>;
