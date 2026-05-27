/**
 * One captured `console.*` invocation. `value` is the argv (the spread of
 * `console.log(...args)`), so `console.log("user:", user)` shows up as a
 * single row with both pieces rendered inline, separated by a space — same
 * as a real DevTools console.
 */
export interface IConsoleMessage {
  type: "debug" | "dir" | "error" | "info" | "log" | "table" | "warn";
  value: unknown[];
}
