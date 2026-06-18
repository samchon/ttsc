import type { DebuggerStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DebuggerStatement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link DebuggerStatement}.
 */
export const createDebuggerStatement = (): DebuggerStatement =>
  make("DebuggerStatement", {});
