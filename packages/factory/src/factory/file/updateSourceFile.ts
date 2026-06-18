import type { SourceFile, Statement } from "../../ast";
import { createSourceFile } from "./createSourceFile";

/**
 * Create a {@link SourceFile}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param _source Ignored; present only to mirror the legacy signature.
 * @param statements The statements.
 * @returns The created {@link SourceFile}.
 */
export const updateSourceFile = (
  _source: SourceFile,
  statements: readonly Statement[],
): SourceFile => createSourceFile(statements);
