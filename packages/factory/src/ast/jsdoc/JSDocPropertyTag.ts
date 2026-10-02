import type { EntityName } from "../names/EntityName";
import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@property` (alias `@prop`) JSDoc tag.
 *
 * Built by {@link factory.createJSDocPropertyTag}.
 *
 * Brackets mark the documented name as optional. They are independent of an
 * omitted type and the name/type ordering flag. The tag describes a property
 * without declaring it or checking an object's members.
 *
 * @evidence contracts/common.md#principled-implementation The entity name, optional braced type and independent bracket and ordering flags express property annotation forms and aliases without asserting that the property exists on a value.
 * @evidence contracts/common.md#clear-and-simple-design Separate syntax choices remain explicit booleans beside structured operands, avoiding duplicate name-first and type-first tag types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Property information is supplied through the public annotation record rather than known-shape hardcoding or patched object members.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains independent bracket, type and order choices and the declaration boundary; members and paragraphs are separated under the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocPropertyTag {
  /** Discriminant tag; always `"JSDocPropertyTag"`. */
  kind: "JSDocPropertyTag";

  /** The tag name, e.g. `prop`. */
  tagName: Identifier;

  /** The property name. */
  name: EntityName;

  /** Whether the name was wrapped in brackets (optional property). */
  isBracketed: boolean;

  /** Braced type annotation; omission does not suppress the property name. */
  typeExpression?: JSDocTypeExpression;

  /** Whether the name was written before the type. */
  isNameFirst: boolean;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
