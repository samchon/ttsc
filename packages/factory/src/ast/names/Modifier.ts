import type { Token } from "./Token";

/**
 * A modifier token (e.g. `export`, `public`, `readonly`).
 *
 * Built by {@link factory.createModifier}.
 *
 * This alias accepts any Token; it does not restrict the token to a valid
 * modifier or check which declarations permit it.
 *
 * @evidence contracts/common.md#principled-implementation A modifier uses the common Token representation; its unrestricted token kind is explicitly broader than valid modifier syntax.
 * @evidence contracts/common.md#clear-and-simple-design An alias shares token storage rather than duplicating a second keyword structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This type alias introduces no runtime patch or fixture-dependent variant.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the token restriction limitation and constructor, in separate paragraphs following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type Modifier = Token;
