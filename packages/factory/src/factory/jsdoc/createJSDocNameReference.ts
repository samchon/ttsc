import type {
  EntityName,
  JSDocMemberName,
  JSDocNameReference,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocNameReference}: a JSDoc reference to a declared name.
 *
 * The `name` is the referenced entity or member name. The printer emits that
 * name directly, with no surrounding decoration. This node is what tags such as
 * `@see` carry as their target.
 *
 * With a `Foo` name, the printer emits:
 *
 * ```ts
 * Foo
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Wrapping the entity or member node records a reference role while preserving the contained name for undecorated printing; construction does not resolve a declaration.
 * @evidence contracts/common.md#clear-and-simple-design The one-field adapter reuses name structure and leaves surrounding tag syntax to its owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied name remains explicit data rather than a guessed target or consumer-specific reference fallback.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains undecorated reference output and its use by see tags, with a corrected example and separate paragraphs under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The referenced name.
 * @returns The created {@link JSDocNameReference}.
 */
export const createJSDocNameReference = (
  name: EntityName | JSDocMemberName,
): JSDocNameReference =>
  make("JSDocNameReference", {
    name,
  });
