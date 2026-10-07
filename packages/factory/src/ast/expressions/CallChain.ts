import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * An optional call, e.g. `a?.()`.
 *
 * Built by {@link factory.createCallChain}.
 *
 * The marker controls this call link only. Without it, the call can continue an
 * optional chain established by its callee. Argument and type-argument legality
 * is supplied by the caller rather than checked here.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Separate callee, optional-link marker and argument sequences represent whether this call introduces ?. or continues an earlier chain; the chain kind preserves that distinction from CallExpression.
 * @evidence contracts/common.md#clear-and-simple-design One call outline holds its own link and ordered arguments; it does not flatten or duplicate the callee's preceding chain links.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optional-call spelling follows an explicit marker, not a guessed nullability check or replacement callee.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains marker absence and chain continuation; optional members state printed effects with separate documentation and tag blocks.
 */
export interface CallChain {
  /** Discriminant tag; always `"CallChain"`. */
  kind: "CallChain";

  /** Callee, possibly containing earlier optional-chain links. */
  expression: Expression;

  /** Presence makes this call optional; absence continues with a plain call. */
  questionDotToken?: Token;

  /** Explicit generic arguments; absent means no angle-bracket list. */
  typeArguments?: readonly TypeNode[];

  /** Ordered call arguments; an empty sequence prints an empty argument list. */
  arguments: readonly Expression[];
}
