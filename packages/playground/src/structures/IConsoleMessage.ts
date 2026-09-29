/**
 * One captured `console.*` invocation. `value` is the argv (the spread of
 * `console.log(...args)`), so `console.log("user:", user)` shows up as a single
 * row with both pieces rendered inline, separated by a space — same as a real
 * DevTools console.
 *
 * @evidence contracts/common.md#principled-implementation The finite console-method union labels one captured invocation; unknown arguments preserve values without pretending every value is serializable.
 * @evidence contracts/common.md#clear-and-simple-design Method and argument list keep event identity separate from renderer policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Console labels are supported invocation kinds, not special cases for particular user output.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains argument grouping and display meaning in a separate paragraph under the documentation skill.
 */
export interface IConsoleMessage {
  type: "debug" | "dir" | "error" | "info" | "log" | "table" | "warn";
  value: unknown[];
}
