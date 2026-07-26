/**
 * Synthetic comment attachment, mirroring the legacy
 * `ts.addSyntheticLeadingComment` family of helpers.
 *
 * The legacy TypeScript compiler stores synthesized comments on a side-band
 * `node.emitNode` slot rather than on the node itself; this module reproduces
 * that behaviour with realm-shared {@link WeakMap}s so the
 * {@link import("./ast").Node} interfaces stay free of printer-only metadata and
 * frozen nodes remain valid targets. {@link TsPrinter} consults these stores
 * while emitting and renders the comments verbatim — a leading comment is
 * printed before the node, a trailing comment after it.
 *
 * ```typescript
 * import factory, {
 *   SyntaxKind,
 *   TsPrinter,
 *   addSyntheticLeadingComment,
 * } from "@ttsc/factory";
 *
 * const node = addSyntheticLeadingComment(
 *   factory.createTypeAliasDeclaration(
 *     undefined,
 *     "ID",
 *     undefined,
 *     factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
 *   ),
 *   SyntaxKind.MultiLineCommentTrivia,
 *   "*\n * The identifier.\n ",
 *   true,
 * );
 * new TsPrinter().print(node);
 * // /**
 * //  * The identifier.
 * //  *\/
 * // type ID = string;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
import type { Node } from "./ast";
import { SyntaxKind } from "./syntax";

/**
 * A synthesized comment attached to a {@link Node}.
 *
 * Mirrors the legacy `ts.SynthesizedComment`. The {@link text} is the raw
 * content placed between the comment delimiters — without the leading `//` of a
 * single-line comment or the surrounding `/*` / `*\/` of a multi-line comment.
 */
export interface SynthesizedComment {
  /** Whether the comment renders as `//` (single-line) or `/* *\/` (multi-line). */
  kind: SyntaxKind.SingleLineCommentTrivia | SyntaxKind.MultiLineCommentTrivia;
  /** The raw comment body, excluding the delimiters. */
  text: string;
  /** Emit a line break after the comment. Always implied for single-line. */
  hasTrailingNewLine?: boolean;
  /** Emit a line break before a trailing comment instead of a space. */
  hasLeadingNewLine?: boolean;
}

interface SyntheticCommentStores {
  leading: WeakMap<object, SynthesizedComment[]>;
  trailing: WeakMap<object, SynthesizedComment[]>;
}

/**
 * One versioned registry per JavaScript realm.
 *
 * A package can be loaded through both its CommonJS and ESM entry points, and
 * package managers may install multiple physical copies. Module-local WeakMaps
 * make those copies silently lose each other's comments even though factory
 * nodes are otherwise structural. A well-known, versioned key gives every
 * compatible copy the same side-band stores without writing metadata to the
 * node, so `Object.freeze(node)` keeps working as it did before.
 *
 * The version belongs to the stored value shape. A future incompatible shape
 * must use another key rather than reinterpret an older registry.
 */
const SYNTHETIC_COMMENT_STORES = Symbol.for(
  "@ttsc/factory.syntheticComments.v1",
);

const commentStores = (): SyntheticCommentStores => {
  const existing: unknown = Reflect.get(globalThis, SYNTHETIC_COMMENT_STORES);
  if (existing !== undefined) return existing as SyntheticCommentStores;
  const created: SyntheticCommentStores = {
    leading: new WeakMap<object, SynthesizedComment[]>(),
    trailing: new WeakMap<object, SynthesizedComment[]>(),
  };
  Object.defineProperty(globalThis, SYNTHETIC_COMMENT_STORES, {
    configurable: false,
    enumerable: false,
    value: created,
    writable: false,
  });
  return created;
};

const { leading: leadingStore, trailing: trailingStore } = commentStores();

const append = (
  store: WeakMap<object, SynthesizedComment[]>,
  node: object,
  comment: SynthesizedComment,
): void => {
  const list: SynthesizedComment[] | undefined = store.get(node);
  if (list !== undefined) list.push(comment);
  else store.set(node, [comment]);
};

/**
 * Attach a synthesized leading comment to a node.
 *
 * Drop-in replacement for the legacy `ts.addSyntheticLeadingComment`. The
 * comment is rendered by {@link TsPrinter} immediately before the node. The node
 * is returned for call chaining.
 *
 * @param node The target node.
 * @param kind Single-line (`//`) or multi-line (`/* *\/`) comment.
 * @param text The raw comment body, excluding the delimiters.
 * @param hasTrailingNewLine Whether to break the line after the comment.
 * @returns The same `node`.
 */
export const addSyntheticLeadingComment = <T extends Node>(
  node: T,
  kind: SynthesizedComment["kind"],
  text: string,
  hasTrailingNewLine?: boolean,
): T => {
  append(leadingStore, node, { kind, text, hasTrailingNewLine });
  return node;
};

/**
 * Attach a synthesized trailing comment to a node.
 *
 * Drop-in replacement for the legacy `ts.addSyntheticTrailingComment`. The
 * comment is rendered by {@link TsPrinter} immediately after the node. The node
 * is returned for call chaining.
 *
 * @param node The target node.
 * @param kind Single-line (`//`) or multi-line (`/* *\/`) comment.
 * @param text The raw comment body, excluding the delimiters.
 * @param hasTrailingNewLine Whether to break the line after the comment.
 * @returns The same `node`.
 */
export const addSyntheticTrailingComment = <T extends Node>(
  node: T,
  kind: SynthesizedComment["kind"],
  text: string,
  hasTrailingNewLine?: boolean,
): T => {
  append(trailingStore, node, { kind, text, hasTrailingNewLine });
  return node;
};

/** Read the synthesized leading comments attached to `node`, if any. */
export const getSyntheticLeadingComments = (
  node: Node,
): SynthesizedComment[] | undefined => leadingStore.get(node);

/** Read the synthesized trailing comments attached to `node`, if any. */
export const getSyntheticTrailingComments = (
  node: Node,
): SynthesizedComment[] | undefined => trailingStore.get(node);

/**
 * Replace the synthesized leading comments of `node`.
 *
 * Passing `undefined` (or an empty list) clears them. The node is returned for
 * call chaining.
 */
export const setSyntheticLeadingComments = <T extends Node>(
  node: T,
  comments: readonly SynthesizedComment[] | undefined,
): T => {
  if (comments !== undefined && comments.length !== 0)
    leadingStore.set(node, comments.slice());
  else leadingStore.delete(node);
  return node;
};

/**
 * Replace the synthesized trailing comments of `node`.
 *
 * Passing `undefined` (or an empty list) clears them. The node is returned for
 * call chaining.
 */
export const setSyntheticTrailingComments = <T extends Node>(
  node: T,
  comments: readonly SynthesizedComment[] | undefined,
): T => {
  if (comments !== undefined && comments.length !== 0)
    trailingStore.set(node, comments.slice());
  else trailingStore.delete(node);
  return node;
};
