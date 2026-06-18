import type { SourceFile, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SourceFile}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link SourceFile}.
 */
export const createSourceFile = (
  statements: readonly Statement[],
): SourceFile => make("SourceFile", { statements });
