import type { SourceFile, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link SourceFile}: the root node of one TypeScript file, holding its
 * top-level statements.
 *
 * The `statements` become the file body in order. Printing the source file
 * emits each statement on its own line followed by a final newline; an empty
 * list prints only that newline.
 *
 * Given a single import of `a` from `"./mod"` as the only statement, this
 * prints:
 *
 * ```ts
 * import { a } from "./mod";
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   SourceFile retains the ordered Statement array as its file body; empty
 *   statements represent an empty outline rather than a synthesized declaration.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The root owns statement grouping; syntax formatting and newlines belong to
 *   the printer, with no compiler Program or filesystem ownership here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Caller statements are retained directly without injecting expected imports.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states file-body ordering and empty behavior, using a separate import
 *   example and blank comment lines before acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statements The statements.
 * @returns The created {@link SourceFile}.
 */
export const createSourceFile = (
  statements: readonly Statement[],
): SourceFile => make("SourceFile", { statements });
