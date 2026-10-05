import type { Token } from "./Token";

/**
 * A modifier token (e.g. `export`, `public`, `readonly`).
 *
 * Built by {@link factory.createModifier}.
 *
 * This alias accepts any Token; it does not restrict the token to a valid
 * modifier or check which declarations permit it.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation A modifier uses the common Token representation; its unrestricted token kind is explicitly broader than valid modifier syntax.
 * @evidence contracts/common.md#clear-and-simple-design An alias shares token storage rather than duplicating a second keyword structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This type alias introduces no runtime patch or fixture-dependent variant.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the token restriction limitation and constructor, in separate paragraphs following the documentation skill.
 */
export type Modifier = Token;
