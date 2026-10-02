import type { Token } from "../names/Token";
import type { Expression } from "./Expression";

/**
 * An optional element access, e.g. `a?.[k]`.
 *
 * Built by {@link factory.createElementAccessChain}.
 *
 * An absent marker continues a chain without introducing a new optional
 * access. The index remains an expression, not a precomputed property key.
 *
 * @evidence contracts/common.md#principled-implementation Receiver, index and optional-link presence distinguish an optional indexed access from a plain continuation; the chain kind preserves its relation to preceding links.
 * @evidence contracts/common.md#clear-and-simple-design This node stores one access link and reuses its receiver subtree rather than flattening or copying the entire chain.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The index is supplied expression syntax and optional access is an explicit marker, not a guessed key or patched receiver.
 * @evidence contracts/common.md#meaningful-documentation Native prose and field comments explain marker absence, receiver and index roles; member spacing and tag separation follow documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ElementAccessChain {
  /** Discriminant tag; always `"ElementAccessChain"`. */
  kind: "ElementAccessChain";

  /** Receiver, possibly containing preceding optional-chain links. */
  expression: Expression;

  /** Presence prints `?.[`; absence prints `[` as a chain continuation. */
  questionDotToken?: Token;

  /** Index expression enclosed by square brackets. */
  argumentExpression: Expression;
}
