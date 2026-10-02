/**
 * The `this` type.
 *
 * Built by {@link factory.createThisTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind records the this type rather than a value identifier; applicability in its surrounding type context is not checked here.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only shape needs no payload because its printed spelling is fixed language syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed this spelling is a language keyword, not a fixture-derived type answer.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes type-space this and its constructor; prose/tag separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ThisTypeNode {
  /** Discriminant tag; always `"ThisTypeNode"`. */
  kind: "ThisTypeNode";
}
