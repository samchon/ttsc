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
 *
 * @evidence contracts/common.md#principled-implementation The trivia discriminant distinguishes delimiter syntax; text excludes those delimiters and optional flags express the two independent line boundaries.
 * @evidence contracts/common.md#clear-and-simple-design One record carries comment content and placement flags; storage identity belongs to the attachment operations rather than this value.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported trivia kinds and optional flags encode comment semantics, without consumer names or executable test exceptions.
 * @evidence contracts/common.md#meaningful-documentation The type and separated member comments explain raw text, delimiter selection and the distinct leading and trailing line effects, using the documentation skill's paragraph and member separation.
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

const createCommentStores = (): SyntheticCommentStores => ({
  leading: new WeakMap<object, SynthesizedComment[]>(),
  trailing: new WeakMap<object, SynthesizedComment[]>(),
});

const localCommentStores = createCommentStores();

const commentStores = (): SyntheticCommentStores => {
  const existing: unknown = Reflect.get(globalThis, SYNTHETIC_COMMENT_STORES);
  if (existing !== undefined) return existing as SyntheticCommentStores;
  try {
    Object.defineProperty(globalThis, SYNTHETIC_COMMENT_STORES, {
      configurable: false,
      enumerable: false,
      value: localCommentStores,
      writable: false,
    });
    return localCommentStores;
  } catch {
    // Hardened realms can prohibit new global properties. Preserve the
    // historical single-module behaviour there instead of making package load
    // fail; cross-copy sharing necessarily requires a realm-owned rendezvous.
    return localCommentStores;
  }
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
 * @evidence contracts/common.md#principled-implementation Appending to the node's leading weak-store list preserves insertion order and object identity; the printer reads that same store before emitting the node.
 * @evidence contracts/common.md#clear-and-simple-design The public adapter constructs one comment record and delegates ordered insertion to append, keeping the leading and trailing storage distinction explicit.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The registry is this package's own versioned rendezvous, not a replacement of foreign methods; frozen nodes remain unchanged and hardened-realm fallback has the documented sharing limit.
 * @evidence contracts/common.md#meaningful-documentation Native prose and parameter tags describe leading placement, raw body and chainable identity; descriptive paragraphs are separated from tags according to the documentation skill.
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
 * @evidence contracts/common.md#principled-implementation Appending to the trailing weak-store list preserves comment order without changing node identity; the printer emits this list after the node body.
 * @evidence contracts/common.md#clear-and-simple-design The trailing adapter differs from leading attachment only in its explicit store, while the shared append helper owns list insertion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Attachment mutates package-owned side-band metadata rather than node or compiler internals; the realm registry and fallback serve the documented cross-copy contract.
 * @evidence contracts/common.md#meaningful-documentation Prose and parameter tags explain placement, raw text and the returned original node, with paragraph separation and native JSDoc syntax required by the documentation skill.
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

/**
 * Read the synthesized leading comments attached to `node`, if any.
 *
 * The returned list is the live stored list. Use the replacement helper to
 * supply a separate list; this getter does not copy or freeze comments.
 *
 * @evidence contracts/common.md#principled-implementation WeakMap lookup uses the exact node object and returns undefined when no leading attachment exists; returning the stored list preserves the legacy live-list API.
 * @evidence contracts/common.md#clear-and-simple-design One direct lookup exposes existing leading metadata without a second index or a hidden copy policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The lookup reads package-owned metadata without altering node properties, compiler methods or behavior for named consumers.
 * @evidence contracts/common.md#meaningful-documentation Native prose states absent and live-list behavior so callers understand mutation ownership; paragraphs and tags follow the documentation skill.
 */
export const getSyntheticLeadingComments = (
  node: Node,
): SynthesizedComment[] | undefined => leadingStore.get(node);

/**
 * Read the synthesized trailing comments attached to `node`, if any.
 *
 * The returned list is the live stored list. Use the replacement helper to
 * supply a separate list; this getter does not copy or freeze comments.
 *
 * @evidence contracts/common.md#principled-implementation Exact object identity selects the trailing weak-store entry; an unattached node yields undefined and an attached node exposes the legacy live list.
 * @evidence contracts/common.md#clear-and-simple-design A direct trailing-store read keeps lookup independent of replacement and printer formatting responsibilities.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reading the package's own weak metadata neither patches foreign code nor writes printer fields onto the AST node.
 * @evidence contracts/common.md#meaningful-documentation The getter documents optional presence and live-list ownership in separate paragraphs before the tags, following the documentation skill's clarity guidance.
 */
export const getSyntheticTrailingComments = (
  node: Node,
): SynthesizedComment[] | undefined => trailingStore.get(node);

/**
 * Replace the synthesized leading comments of `node`.
 *
 * Passing `undefined` (or an empty list) clears them. The node is returned for
 * call chaining.
 *
 * Nonempty input is copied shallowly: later changes to the caller's array do
 * not replace stored membership, while individual comment records remain shared.
 *
 * @evidence contracts/common.md#principled-implementation Empty or absent input deletes the node's entry; nonempty input is shallow-copied into the leading store, preserving order and returning the original node.
 * @evidence contracts/common.md#clear-and-simple-design The setter owns replacement and clearing directly; it does not mix those operations with append or printer layout.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Replacement changes package-owned side-band state through its public API, with no foreign mutation or fixture-specific clearing rule.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs state clearing, chaining and shallow-copy ownership; tags remain separated from prose as required by the documentation skill.
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
 *
 * Nonempty input is copied shallowly: later changes to the caller's array do
 * not replace stored membership, while individual comment records remain shared.
 *
 * @evidence contracts/common.md#principled-implementation Deletion represents no trailing comments; a shallow copy records nonempty replacement membership without taking ownership of the caller's array.
 * @evidence contracts/common.md#clear-and-simple-design Replacement and deletion are explicit branches over the trailing store, leaving ordered append and formatting to their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation uses the documented attachment boundary and package-owned metadata; neither node internals nor foreign compiler functions are patched.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain empty clearing, returned identity and shared records versus copied membership, applying the documentation skill's separation and precise prose.
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
