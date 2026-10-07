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
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The protected annotation retains its tag identifier and optional prose, while inheritance and protected-access semantics remain outside this printable representation.
 * @evidence contracts/common.md#clear-and-simple-design No class hierarchy or duplicate access modifier is needed to store one documentation marker and its description.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Protected visibility is represented as supplied syntax rather than an inheritance guess or a patched foreign member definition.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the inheritance and access-control boundary and absent-description behavior, with paragraph and field separation following the documentation guidance.
 */
export interface JSDocProtectedTag {
  /** Discriminant tag; always `"JSDocProtectedTag"`. */
  kind: "JSDocProtectedTag";

  /** The tag name, e.g. `protected`. */
  tagName: Identifier;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
