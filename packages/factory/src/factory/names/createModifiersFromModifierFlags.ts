import type { Modifier } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createModifier } from "./createModifier";

/**
 * Legacy `ts.ModifierFlags` bit values, kept as module-local constants (not an
 * exported enum) so callers can pass the same numeric bitmask.
 */
const FLAG = {
  Public: 1,
  Private: 2,
  Protected: 4,
  Readonly: 8,
  Override: 16,
  Export: 32,
  Abstract: 64,
  Ambient: 128,
  Static: 256,
  Accessor: 512,
  Async: 1024,
  Default: 2048,
  Const: 4096,
  In: 8192,
  Out: 16384,
} as const;

/**
 * Create an ordered list of modifier tokens from a legacy `ts.ModifierFlags`
 * bitmask.
 *
 * The `flags` is read bit by bit, and one modifier token is appended for each
 * bit that is set. The tokens come out in canonical declaration order
 * regardless of bit order in the input, so `export` precedes `readonly` no
 * matter how the mask was assembled. When no recognized bit is set, the result
 * is `undefined` rather than an empty array.
 *
 * Variance flags produce `in` then `out`, preserving the legacy factory's order
 * when both are present. Bits without a represented modifier keyword are
 * ignored rather than converted to an unrelated token.
 *
 * With `flags` of `Export | Readonly`, the tokens print in order as:
 *
 * ```ts
 * export readonly
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param flags The modifier flags bitmask (legacy `ts.ModifierFlags`).
 * @returns The created modifier tokens, or `undefined` when none apply.
 * @evidence contracts/common.md#principled-implementation
 *   Bit tests read legacy ModifierFlags values and append tokens in declaration
 *   order, independent of bit ordering. No recognized bits yields undefined.
 *   In and Out preserve the legacy variance bits and their order.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The local flag table defines numeric compatibility and the fixed append
 *   sequence defines ordering; createModifier retains shared token construction.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Numeric constants are the legacy flag protocol, not case-specific answers.
 *   Unrecognized bits are not substituted with a different keyword.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc records ordering, undefined empty results and variance modifiers in
 *   separate paragraphs with an example, following documentation guidance.
 */
export const createModifiersFromModifierFlags = (
  flags: number,
): readonly Modifier[] | undefined => {
  const result: Modifier[] = [];
  if (flags & FLAG.Export)
    result.push(createModifier(SyntaxKind.ExportKeyword));
  if (flags & FLAG.Ambient)
    result.push(createModifier(SyntaxKind.DeclareKeyword));
  if (flags & FLAG.Default)
    result.push(createModifier(SyntaxKind.DefaultKeyword));
  if (flags & FLAG.Const) result.push(createModifier(SyntaxKind.ConstKeyword));
  if (flags & FLAG.Public)
    result.push(createModifier(SyntaxKind.PublicKeyword));
  if (flags & FLAG.Private)
    result.push(createModifier(SyntaxKind.PrivateKeyword));
  if (flags & FLAG.Protected)
    result.push(createModifier(SyntaxKind.ProtectedKeyword));
  if (flags & FLAG.Abstract)
    result.push(createModifier(SyntaxKind.AbstractKeyword));
  if (flags & FLAG.Static)
    result.push(createModifier(SyntaxKind.StaticKeyword));
  if (flags & FLAG.Override)
    result.push(createModifier(SyntaxKind.OverrideKeyword));
  if (flags & FLAG.Readonly)
    result.push(createModifier(SyntaxKind.ReadonlyKeyword));
  if (flags & FLAG.Accessor)
    result.push(createModifier(SyntaxKind.AccessorKeyword));
  if (flags & FLAG.Async) result.push(createModifier(SyntaxKind.AsyncKeyword));
  if (flags & FLAG.In) result.push(createModifier(SyntaxKind.InKeyword));
  if (flags & FLAG.Out) result.push(createModifier(SyntaxKind.OutKeyword));
  return result.length ? result : undefined;
};
