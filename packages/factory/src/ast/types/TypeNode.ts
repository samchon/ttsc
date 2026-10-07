import type { JSDocAllType } from "../jsdoc/JSDocAllType";
import type { JSDocFunctionType } from "../jsdoc/JSDocFunctionType";
import type { JSDocNamepathType } from "../jsdoc/JSDocNamepathType";
import type { JSDocNonNullableType } from "../jsdoc/JSDocNonNullableType";
import type { JSDocNullableType } from "../jsdoc/JSDocNullableType";
import type { JSDocOptionalType } from "../jsdoc/JSDocOptionalType";
import type { JSDocUnknownType } from "../jsdoc/JSDocUnknownType";
import type { JSDocVariadicType } from "../jsdoc/JSDocVariadicType";
import type { ArrayTypeNode } from "./ArrayTypeNode";
import type { ConditionalTypeNode } from "./ConditionalTypeNode";
import type { ConstructorTypeNode } from "./ConstructorTypeNode";
import type { FunctionTypeNode } from "./FunctionTypeNode";
import type { ImportTypeNode } from "./ImportTypeNode";
import type { IndexedAccessTypeNode } from "./IndexedAccessTypeNode";
import type { InferTypeNode } from "./InferTypeNode";
import type { IntersectionTypeNode } from "./IntersectionTypeNode";
import type { KeywordTypeNode } from "./KeywordTypeNode";
import type { LiteralTypeNode } from "./LiteralTypeNode";
import type { MappedTypeNode } from "./MappedTypeNode";
import type { NamedTupleMember } from "./NamedTupleMember";
import type { OptionalTypeNode } from "./OptionalTypeNode";
import type { ParenthesizedTypeNode } from "./ParenthesizedTypeNode";
import type { RestTypeNode } from "./RestTypeNode";
import type { TemplateLiteralTypeNode } from "./TemplateLiteralTypeNode";
import type { ThisTypeNode } from "./ThisTypeNode";
import type { TupleTypeNode } from "./TupleTypeNode";
import type { TypeLiteralNode } from "./TypeLiteralNode";
import type { TypeOperatorNode } from "./TypeOperatorNode";
import type { TypePredicateNode } from "./TypePredicateNode";
import type { TypeQueryNode } from "./TypeQueryNode";
import type { TypeReferenceNode } from "./TypeReferenceNode";
import type { UnionTypeNode } from "./UnionTypeNode";

/**
 * The supported printable TypeScript and JSDoc type forms.
 *
 * This union describes syntax data. It does not establish assignability, name
 * resolution or legal placement of each variant in a containing type.
 * JSDoc-specific forms compose through this union but are not ordinary
 * TypeScript type syntax; tuple element wrappers also require their own
 * context.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The union groups supported type forms by their literal kinds, including JSDoc forms consumed by braced types and wrappers and named/optional/rest tuple forms; membership does not certify legal placement or semantic validity.
 * @evidence contracts/common.md#clear-and-simple-design One shared alias owns type alternatives while concrete variants own their operands and fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Variants represent syntax forms rather than consumer-specific or precomputed type results.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes supported syntax from semantic checking and explains contextual restrictions on JSDoc and tuple variants; separate paragraphs follow the documentation skill.
 */
export type TypeNode =
  | ArrayTypeNode
  | ConditionalTypeNode
  | ConstructorTypeNode
  | FunctionTypeNode
  | ImportTypeNode
  | IndexedAccessTypeNode
  | InferTypeNode
  | IntersectionTypeNode
  | JSDocAllType
  | JSDocFunctionType
  | JSDocNamepathType
  | JSDocNonNullableType
  | JSDocNullableType
  | JSDocOptionalType
  | JSDocUnknownType
  | JSDocVariadicType
  | KeywordTypeNode
  | LiteralTypeNode
  | MappedTypeNode
  | NamedTupleMember
  | OptionalTypeNode
  | ParenthesizedTypeNode
  | RestTypeNode
  | TemplateLiteralTypeNode
  | ThisTypeNode
  | TupleTypeNode
  | TypeLiteralNode
  | TypeOperatorNode
  | TypePredicateNode
  | TypeQueryNode
  | TypeReferenceNode
  | UnionTypeNode;
