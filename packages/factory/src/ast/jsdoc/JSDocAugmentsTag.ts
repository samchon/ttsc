import type { Identifier } from "../names/Identifier";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";
import type { JSDocComment } from "./JSDocComment";

/**
 * An `@augments` (synonym `@extends`) JSDoc tag.
 *
 * Built by {@link factory.createJSDocAugmentsTag}.
 *
 * The class expression is printed in braces. The tag name preserves spellings
 * such as `augments` or `extends`; the node does not resolve the base class.
 *
 * @evidence contracts/common.md#principled-implementation A structured class expression and explicit tag identifier represent inheritance annotation syntax, including aliases, without establishing that the documented declaration extends the target.
 * @evidence contracts/common.md#clear-and-simple-design The base expression owns its type arguments while this tag owns spelling and description, avoiding a duplicate inheritance model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alias spelling is caller data at the supported tag boundary rather than a consumer-name exception or a patched class hierarchy.
 * @evidence contracts/common.md#meaningful-documentation Native prose states brace output, alias spelling and unresolved inheritance; separated member descriptions and paragraphs follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocAugmentsTag {
  /** Discriminant tag; always `"JSDocAugmentsTag"`. */
  kind: "JSDocAugmentsTag";

  /** The tag name, e.g. `augments`. */
  tagName: Identifier;

  /** The augmented class. */
  class: ExpressionWithTypeArguments;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
