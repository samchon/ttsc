/**
 * Verifies jsx-a11y/html-has-lang: `<html>` needs a non-empty `lang`.
 *
 * Pins both invalid branches: omitting the attribute and supplying an empty
 * value leave assistive technology without a document language.
 *
 * 1. Render `<html>` elements with a missing and empty `lang`.
 * 2. Lint flags both invalid language declarations.
 */
// expect: jsx-a11y/html-has-lang error
export const MissingLang = () => <html />;

// expect: jsx-a11y/html-has-lang error
export const EmptyLang = () => <html lang="" />;
