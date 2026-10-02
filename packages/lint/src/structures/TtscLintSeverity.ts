/**
 * Rule severity accepted by `@ttsc/lint`.
 *
 * String values are the documented public form. Numeric values match the
 * conventional ESLint severity ladder and are accepted for compatibility with
 * existing rule maps.
 *
 * @evidence contracts/common.md#principled-implementation The literal union represents the host's three severity levels including documented string and numeric aliases.
 * @evidence contracts/common.md#clear-and-simple-design A single alias supplies severity choices to every rule setting without independent copies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Values are public severity discriminants rather than consumer-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains string conventions and numeric compatibility; the tag block is separated according to documentation guidance.
 */
export type TtscLintSeverity = "off" | "warning" | "warn" | "error" | 0 | 1 | 2;
