import type { JsxElement } from "../jsx/JsxElement";
import type { JsxFragment } from "../jsx/JsxFragment";
import type { JsxSelfClosingElement } from "../jsx/JsxSelfClosingElement";
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

/**
 * Any expression node.
 *
 * This construction union includes tokens, spread elements and array holes
 * whose legality depends on the enclosing grammar. Membership alone does not
 * establish a valid standalone expression or assignment target. Nodes must
 * form an acyclic outline for recursive printing.
 *
 * @evidence contracts/common.md#principled-implementation The union retains concrete discriminated expression forms, including context-specific syntax; its broad Token and hole members require grammar validity from the caller rather than certifying arbitrary members as standalone expressions.
 * @evidence contracts/common.md#clear-and-simple-design Concrete node types supply their own constituents while one shared union enables recursive operands without a base object carrying unrelated optional fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Named variants preserve real outline structure rather than replacing unknown expressions with a consumer-specific catch-all payload.
 * @evidence contracts/common.md#meaningful-documentation Native prose states context sensitivity, assignment-target limits and acyclic ownership; the tag block is distinct under the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
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
