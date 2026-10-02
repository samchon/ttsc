/**
 * The opening fragment of a {@link JsxFragment}, i.e. `<>`.
 *
 * Built by {@link factory.createJsxOpeningFragment}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind preserves the name-free opening fragment delimiter without inventing element attributes or a tag name.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only interface is sufficient for fixed opening syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The delimiter is JSX syntax, not a consumer-specific runtime factory value.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the exact opening delimiter and constructor; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JsxOpeningFragment {
  /** Discriminant tag; always `"JsxOpeningFragment"`. */
  kind: "JsxOpeningFragment";
}
