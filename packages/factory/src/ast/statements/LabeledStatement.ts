import type { Identifier } from "../names/Identifier";
import type { Statement } from "./Statement";

/**
 * A labeled statement, e.g. `outer: for (...) {}`.
 *
 * Built by {@link factory.createLabeledStatement}.
 *
 * @evidence contracts/common.md#principled-implementation An Identifier and Statement preserve a label attached to one statement; uniqueness and valid break/continue targeting are not checked here.
 * @evidence contracts/common.md#clear-and-simple-design Two fields separate label spelling from the labeled statement's structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Label text is supplied data rather than a hardcoded control-flow target.
 * @evidence contracts/common.md#meaningful-documentation JSDoc gives a loop-label example and labels both payloads; separated comments follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface LabeledStatement {
  /** Discriminant tag; always `"LabeledStatement"`. */
  kind: "LabeledStatement";

  /** Label identifier printed before the colon. */
  label: Identifier;

  /** Statement to which the label applies. */
  statement: Statement;
}
