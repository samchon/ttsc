import type { VariableDeclaration, VariableDeclarationList } from "../../ast";
import { NodeFlags } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link VariableDeclarationList}: the `const x = 1` group.
 *
 * The `declarations` are the comma-separated declarators, and `flags` chooses
 * the keyword the printer emits: `const`, `let`, or plain `var` when no flag is
 * set. This is the keyword-bearing part shared by a {@link VariableStatement}
 * and by `for` loop headers.
 *
 * The list carries no trailing semicolon on its own. With a single declaration
 * of `x = 1` and the `const` flag, it prints as:
 *
 * ```ts
 * const x = 1
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Ordered declarators and NodeFlags preserve variable-declaration grouping;
 *   no flags selects var while supported flags select the corresponding keyword.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The list owns the keyword but excludes statement termination so the same
 *   grouping works in variable statements and for-loop headers.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   NodeFlags.None is the documented var default, not inferred from fixture names.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains keyword selection and header reuse, with a corrected
 *   semicolon-free list example and separate acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param declarations The declarations.
 * @param flags The declaration flags (`const` / `let` / `var`).
 * @returns The created {@link VariableDeclarationList}.
 */
export const createVariableDeclarationList = (
  declarations: readonly VariableDeclaration[],
  flags: NodeFlags = NodeFlags.None,
): VariableDeclarationList =>
  make("VariableDeclarationList", { declarations, flags });
