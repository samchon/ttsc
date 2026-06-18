import type { Block, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link Block}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link Block}.
 */
export const createBlock = (
  statements: readonly Statement[],
  multiLine?: boolean,
): Block => make("Block", { statements, multiLine: multiLine ?? true });
