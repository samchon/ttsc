import type { SourceFile, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SourceFile}: the root node of one TypeScript file, holding its
 * top-level statements.
 *
 * The `statements` become the file body in order. Printing the source file
 * emits each statement on its own line; an empty list yields an empty file.
 *
 * Given a single import of `a` from `"./mod"` as the only statement, this
 * prints:
 *
 * ```ts
 * import { a } from "./mod";
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link SourceFile}.
 */
export const createSourceFile = (
  statements: readonly Statement[],
): SourceFile => make("SourceFile", { statements });
