import type { JSDocOptionalType, TypeNode } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocOptionalType}: a JSDoc `=`-marked optional type.
 *
 * The `type` is the wrapped type. The printer appends an `=` marker after it.
 *
 * The TypeNode input includes JSDoc-specific wrappers. No default value or
 * optional executable parameter is created, and contextual legality remains
 * the caller's responsibility.
 *
 * With a `number` type, the printer emits:
 *
 * ```ts
 * number=
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Retaining a required TypeNode child under the optional kind encodes an equals suffix without conflating annotation optionality with an absent operand or runtime default.
 * @evidence contracts/common.md#clear-and-simple-design One child assignment is sufficient because the kind determines optional syntax; there is no redundant flag or default-value state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The equals suffix is grammar, not a hardcoded parameter value or a fixture-only optional branch.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains suffix output, contextual validity and lack of a created default with a concrete example; paragraph and tag separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param type The wrapped type.
 * @returns The created {@link JSDocOptionalType}.
 */
export const createJSDocOptionalType = (type: TypeNode): JSDocOptionalType =>
  make("JSDocOptionalType", {
    type,
  });
