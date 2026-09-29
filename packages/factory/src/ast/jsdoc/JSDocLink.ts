import type { EntityName } from "../names/EntityName";
import type { JSDocMemberName } from "./JSDocMemberName";

/**
 * An inline `{@link name text}` JSDoc reference.
 *
 * Built by {@link factory.createJSDocLink}.
 *
 * An absent name leaves a text-only reference. The printer appends text to a
 * present name without inserting a separator, so labels must include a leading
 * space when needed. Target resolution belongs to documentation consumers.
 *
 * @evidence contracts/common.md#principled-implementation An optional entity or member target and required text express both named and text-only link forms; this representation does not assert that the referenced target exists.
 * @evidence contracts/common.md#clear-and-simple-design The target and verbatim suffix are separate fields so name structure remains reusable without parsing the label.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The literal link kind selects ordinary inline syntax; arbitrary targets and labels do not invoke consumer-specific lookup or patched symbol resolution.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absent targets, caller-supplied spacing and unresolved references; separated member comments and paragraphs follow the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocLink {
  /** Discriminant tag; always `"JSDocLink"`. */
  kind: "JSDocLink";

  /** The linked name, if any. */
  name?: EntityName | JSDocMemberName;

  /** Verbatim suffix; include a leading space to separate it from the name. */
  text: string;
}
