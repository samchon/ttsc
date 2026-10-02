import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { TypeNode } from "./TypeNode";

/**
 * A named tuple member, e.g. `[first: string]`.
 *
 * Built by {@link factory.createNamedTupleMember}.
 *
 * @evidence contracts/common.md#principled-implementation A label and element TypeNode plus optional rest/optional markers preserve named tuple syntax; marker combination legality is left to callers.
 * @evidence contracts/common.md#clear-and-simple-design Label, value type and marker presence are distinct fields, without positional flags.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The label is supplied syntax, with no fixture-specific tuple position rule.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates a labeled element and explains marker absence; separated member comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NamedTupleMember {
  /** Discriminant tag; always `"NamedTupleMember"`. */
  kind: "NamedTupleMember";

  /** Rest marker before the label, if present. */
  dotDotDotToken?: Token;

  /** Tuple element label. */
  name: Identifier;

  /** Optional marker after the label, if present. */
  questionToken?: Token;

  /** Type of the labeled tuple element. */
  type: TypeNode;
}
