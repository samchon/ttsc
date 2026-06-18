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
 */
export const createDebuggerStatement = (): DebuggerStatement =>
  make("DebuggerStatement", {});
