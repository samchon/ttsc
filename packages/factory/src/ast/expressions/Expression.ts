import type { Identifier } from "../names/Identifier";
import type { Token } from "../names/Token";
import type { ArrayLiteralExpression } from "./ArrayLiteralExpression";
import type { ArrowFunction } from "./ArrowFunction";
import type { AsExpression } from "./AsExpression";
import type { AwaitExpression } from "./AwaitExpression";
import type { BigIntLiteral } from "./BigIntLiteral";
import type { BinaryExpression } from "./BinaryExpression";
import type { CallChain } from "./CallChain";
import type { CallExpression } from "./CallExpression";
import type { ClassExpression } from "./ClassExpression";
import type { CommaListExpression } from "./CommaListExpression";
import type { ConditionalExpression } from "./ConditionalExpression";
import type { DeleteExpression } from "./DeleteExpression";
import type { ElementAccessChain } from "./ElementAccessChain";
import type { ElementAccessExpression } from "./ElementAccessExpression";
import type { FunctionExpression } from "./FunctionExpression";
import type { MetaProperty } from "./MetaProperty";
import type { NewExpression } from "./NewExpression";
import type { NoSubstitutionTemplateLiteral } from "./NoSubstitutionTemplateLiteral";
import type { NonNullChain } from "./NonNullChain";
import type { NonNullExpression } from "./NonNullExpression";
import type { NumericLiteral } from "./NumericLiteral";
import type { ObjectLiteralExpression } from "./ObjectLiteralExpression";
import type { OmittedExpression } from "./OmittedExpression";
import type { ParenthesizedExpression } from "./ParenthesizedExpression";
import type { PartiallyEmittedExpression } from "./PartiallyEmittedExpression";
import type { PostfixUnaryExpression } from "./PostfixUnaryExpression";
import type { PrefixUnaryExpression } from "./PrefixUnaryExpression";
import type { PropertyAccessChain } from "./PropertyAccessChain";
import type { PropertyAccessExpression } from "./PropertyAccessExpression";
import type { RegularExpressionLiteral } from "./RegularExpressionLiteral";
import type { SatisfiesExpression } from "./SatisfiesExpression";
import type { SpreadElement } from "./SpreadElement";
import type { StringLiteral } from "./StringLiteral";
import type { TaggedTemplateExpression } from "./TaggedTemplateExpression";
import type { TemplateExpression } from "./TemplateExpression";
import type { TypeAssertion } from "./TypeAssertion";
import type { TypeOfExpression } from "./TypeOfExpression";
import type { VoidExpression } from "./VoidExpression";
import type { YieldExpression } from "./YieldExpression";
import type { JsxElement } from "../jsx/JsxElement";
import type { JsxFragment } from "../jsx/JsxFragment";
import type { JsxSelfClosingElement } from "../jsx/JsxSelfClosingElement";

/**
 * Any expression node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type Expression =
  | ArrayLiteralExpression
  | ArrowFunction
  | AsExpression
  | AwaitExpression
  | BigIntLiteral
  | BinaryExpression
  | CallChain
  | CallExpression
  | ClassExpression
  | CommaListExpression
  | ConditionalExpression
  | DeleteExpression
  | ElementAccessChain
  | ElementAccessExpression
  | FunctionExpression
  | Identifier
  | JsxElement
  | JsxFragment
  | JsxSelfClosingElement
  | MetaProperty
  | NewExpression
  | NoSubstitutionTemplateLiteral
  | NonNullChain
  | NonNullExpression
  | NumericLiteral
  | ObjectLiteralExpression
  | OmittedExpression
  | ParenthesizedExpression
  | PartiallyEmittedExpression
  | PostfixUnaryExpression
  | PrefixUnaryExpression
  | PropertyAccessChain
  | PropertyAccessExpression
  | RegularExpressionLiteral
  | SatisfiesExpression
  | SpreadElement
  | StringLiteral
  | TaggedTemplateExpression
  | TemplateExpression
  | Token
  | TypeAssertion
  | TypeOfExpression
  | VoidExpression
  | YieldExpression;
