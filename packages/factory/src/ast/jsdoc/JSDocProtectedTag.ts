import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";

/**
 * A `@protected` JSDoc tag.
 *
 * Built by {@link factory.createJSDocProtectedTag}.
 *
 * The tag documents protected visibility without establishing inheritance or
 * restricting access. An omitted description emits a bare tag.
 *
 * @evidence contracts/common.md#principled-implementation The protected annotation retains its tag identifier and optional prose, while inheritance and protected-access semantics remain outside this printable representation.
 * @evidence contracts/common.md#clear-and-simple-design No class hierarchy or duplicate access modifier is needed to store one documentation marker and its description.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protected visibility is represented as supplied syntax rather than an inheritance guess or a patched foreign member definition.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the inheritance and access-control boundary and absent-description behavior, with paragraph and field separation following the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocProtectedTag {
  /** Discriminant tag; always `"JSDocProtectedTag"`. */
  kind: "JSDocProtectedTag";

  /** The tag name, e.g. `protected`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
