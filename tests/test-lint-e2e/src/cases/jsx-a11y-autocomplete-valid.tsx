/**
 * Verifies jsx-a11y/autocomplete-valid: `autocomplete` tokens must suit the
 * input type that consumes them.
 *
 * Pins type compatibility: `url` is a real token, but an email input cannot
 * consume a URL-specific autofill value.
 *
 * 1. Render an email input with `autocomplete="url"`.
 * 2. Lint flags the token as inappropriate for that input type.
 */
// expect: jsx-a11y/autocomplete-valid error
export const X = () => <input type="email" autoComplete="url" />;
