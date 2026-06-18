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
 * Any type node.
 *
 * @author Jeongho Nam - https://github.com/samchon
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
