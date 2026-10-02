import type {
  JsxAttributes,
  JsxSelfClosingElement,
  JsxTagName,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxSelfClosingElement}: a `<Tag />` element with no children.
 *
 * The tag name accepts a plain identifier, a property-access chain like
 * `Foo.Bar`, or a {@link JsxNamespacedName}. Optional `typeArguments` render as
 * a generic argument list right after the tag name. The attributes carry the
 * element's props; pass an empty {@link JsxAttributes} for none.
 *
 * Given the tag name `Foo`, no type arguments, and attributes holding a single
 * `bar="x"`, the printer emits:
 *
 * ```tsx
 * <Foo bar="x" />
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The tag, ordered type arguments and attributes remain structured inside a
 *   self-closing node, whose syntax has no child list or paired closing node.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One self-closing representation avoids synthesizing an empty paired
 *   element and reuses the same tag and attribute structures as an opening.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Tag names do not select injected props or closure shortcuts; all syntax
 *   derives from the supplied name, generic arguments and attribute collection.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains tag-name forms, generics and empty attributes, with
 *   a concrete self-closing example and all inputs documented.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param typeArguments The generic type arguments, if any.
 * @param attributes The attributes.
 * @returns The created {@link JsxSelfClosingElement}.
 */
export const createJsxSelfClosingElement = (
  tagName: JsxTagName,
  typeArguments: readonly TypeNode[] | undefined,
  attributes: JsxAttributes,
): JsxSelfClosingElement =>
  make("JsxSelfClosingElement", {
    tagName,
    typeArguments,
    attributes,
  });
