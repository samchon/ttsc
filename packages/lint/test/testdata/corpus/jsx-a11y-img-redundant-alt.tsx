/**
 * Verifies jsx-a11y/img-redundant-alt: `alt` should not repeat "image".
 *
 * Pins the "redundant alt phrasing" branch — the `<img>` role already
 * tells assistive tech the element is an image, so words like
 * `"image"`, `"photo"`, or `"picture"` inside `alt` are redundant noise.
 *
 * 1. Render an `<img>` whose `alt` includes the word "photo".
 * 2. Lint flags the redundant alt phrasing.
 */
// expect: jsx-a11y/img-redundant-alt error
export const X = () => <img src="/cat.png" alt="A photo of a cat" />;
