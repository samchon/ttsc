import type { SyntaxKind } from "../../syntax";

/**
 * A bare keyword / operator / punctuation token (e.g. `true`, `readonly`, `+`).
 *
 * Built by {@link factory.createToken}.
 *
 * TKind can narrow the token code. The default permits every SyntaxKind and
 * does not prove that the code denotes a printable token in a given context.
 *
 * @evidence contracts/common.md#principled-implementation The Token wrapper separates token identity from its SyntaxKind code; TKind retains caller narrowing without claiming syntax validation.
 * @evidence contracts/common.md#clear-and-simple-design One generic token shape serves punctuation and keywords without duplicating their storage.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts SyntaxKind codes are language discriminants, not fixture-derived output values.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains generic narrowing and the permissive default separately, following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface Token<TKind extends SyntaxKind = SyntaxKind> {
  /** Discriminant tag; always `"Token"`. */
  kind: "Token";

  /** The token kind. */
  token: TKind;
}
