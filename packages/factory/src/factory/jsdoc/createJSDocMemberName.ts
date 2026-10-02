import type { EntityName, Identifier, JSDocMemberName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocMemberName}: a JSDoc `#`-joined member reference.
 *
 * The `left` is the owning name and `right` is the member. The printer joins
 * them with a `#`, the JSDoc separator for an instance member.
 *
 * With a left of `Foo` and a right of `bar`, the printer emits:
 *
 * ```ts
 * Foo#bar
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The owner or preceding member reference and final identifier are retained as separate operands, preserving a recursive hash-separated name without resolving it.
 * @evidence contracts/common.md#clear-and-simple-design A direct two-operand adapter composes existing names instead of storing a second flattened reference or lookup state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Hash selection is the represented syntax, with caller names unchanged rather than known-member substitutions or patched symbol tables.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies owner, member and hash separator with an output example; separate paragraphs before native tags follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand side.
 * @param right The right-hand side.
 * @returns The created {@link JSDocMemberName}.
 */
export const createJSDocMemberName = (
  left: EntityName | JSDocMemberName,
  right: Identifier,
): JSDocMemberName =>
  make("JSDocMemberName", {
    left,
    right,
  });
