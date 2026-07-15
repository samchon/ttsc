/**
 * Verifies jsx-a11y/lang: `<html lang>` must contain a valid BCP 47 tag.
 *
 * Pins registry validation: html-has-lang accepts this non-empty value, while
 * this rule rejects the unregistered primary language `foo`.
 *
 * 1. Render an `<html>` element with the invalid `lang="foo"` value.
 * 2. Lint flags the unregistered language tag.
 */
// expect: jsx-a11y/lang error
export const X = () => <html lang="foo" />;
