/**
 * Rule severity accepted by `@ttsc/lint`.
 *
 * String values are the documented public form. Numeric values match the
 * conventional ESLint severity ladder and are accepted for compatibility with
 * existing rule maps.
 */
export type TtscLintSeverity = "off" | "warning" | "warn" | "error" | 0 | 1 | 2;
