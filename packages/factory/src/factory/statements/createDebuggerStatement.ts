import type { DebuggerStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DebuggerStatement}: a `debugger;` statement.
 *
 * The statement takes no inputs and triggers a breakpoint when a debugger is
 * attached.
 *
 * The result is always:
 *
 * ```ts
 * debugger;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link DebuggerStatement}.
 * @evidence contracts/common.md#principled-implementation
 *   DebuggerStatement is a zero-field syntax kind; execution of generated source,
 *   not constructing this outline, reaches a debugger breakpoint.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   No payload is needed for the fixed debugger statement grammar.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   debugger is the declared syntax, not instrumentation installed on globals.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the no-input statement and execution condition, with
 *   a source example separate from acknowledgment tags.
 */
export const createDebuggerStatement = (): DebuggerStatement =>
  make("DebuggerStatement", {});
