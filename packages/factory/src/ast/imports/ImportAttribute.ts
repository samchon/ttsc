import type { Expression } from "../expressions/Expression";
import type { ImportAttributeName } from "./ImportAttributeName";

/**
 * A single import attribute entry, e.g. `type: "json"`.
 *
 * Built by {@link factory.createImportAttribute}.
 *
 * @evidence contracts/common.md#principled-implementation Attribute-name alternatives and Expression value preserve a key/value entry; the broad value union does not enforce string-only attribute grammar.
 * @evidence contracts/common.md#clear-and-simple-design Two payload fields delegate name spelling and value syntax to existing representations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Attribute keys and values are supplied syntax rather than hardcoded module handling rules.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates type: json and identifies key/value roles; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ImportAttribute {
  /** Discriminant tag; always `"ImportAttribute"`. */
  kind: "ImportAttribute";

  /** The attribute name. */
  name: ImportAttributeName;

  /** The attribute value. */
  value: Expression;
}
