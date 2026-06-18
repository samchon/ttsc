import type { HeritageClause } from "./clauses/HeritageClause";
import type { ParameterDeclaration } from "./clauses/ParameterDeclaration";
import type { ClassDeclaration } from "./declarations/ClassDeclaration";
import type { ClassStaticBlockDeclaration } from "./declarations/ClassStaticBlockDeclaration";
import type { ConstructorDeclaration } from "./declarations/ConstructorDeclaration";
import type { EnumDeclaration } from "./declarations/EnumDeclaration";
import type { EnumMember } from "./declarations/EnumMember";
import type { ExternalModuleReference } from "./declarations/ExternalModuleReference";
import type { FunctionDeclaration } from "./declarations/FunctionDeclaration";
import type { GetAccessorDeclaration } from "./declarations/GetAccessorDeclaration";
import type { ImportEqualsDeclaration } from "./declarations/ImportEqualsDeclaration";
import type { InterfaceDeclaration } from "./declarations/InterfaceDeclaration";
import type { MethodDeclaration } from "./declarations/MethodDeclaration";
import type { ModuleBlock } from "./declarations/ModuleBlock";
import type { ModuleDeclaration } from "./declarations/ModuleDeclaration";
import type { NamespaceExportDeclaration } from "./declarations/NamespaceExportDeclaration";
import type { PropertyDeclaration } from "./declarations/PropertyDeclaration";
import type { SemicolonClassElement } from "./declarations/SemicolonClassElement";
import type { SetAccessorDeclaration } from "./declarations/SetAccessorDeclaration";
import type { TypeAliasDeclaration } from "./declarations/TypeAliasDeclaration";
import type { ArrayBindingPattern } from "./expressions/ArrayBindingPattern";
import type { ArrayLiteralExpression } from "./expressions/ArrayLiteralExpression";
import type { ArrowFunction } from "./expressions/ArrowFunction";
import type { AsExpression } from "./expressions/AsExpression";
import type { AwaitExpression } from "./expressions/AwaitExpression";
import type { BigIntLiteral } from "./expressions/BigIntLiteral";
import type { BinaryExpression } from "./expressions/BinaryExpression";
import type { BindingElement } from "./expressions/BindingElement";
import type { CallChain } from "./expressions/CallChain";
import type { CallExpression } from "./expressions/CallExpression";
import type { ClassExpression } from "./expressions/ClassExpression";
import type { CommaListExpression } from "./expressions/CommaListExpression";
import type { ComputedPropertyName } from "./expressions/ComputedPropertyName";
import type { ConditionalExpression } from "./expressions/ConditionalExpression";
import type { DeleteExpression } from "./expressions/DeleteExpression";
import type { ElementAccessChain } from "./expressions/ElementAccessChain";
import type { ElementAccessExpression } from "./expressions/ElementAccessExpression";
import type { FunctionExpression } from "./expressions/FunctionExpression";
import type { MetaProperty } from "./expressions/MetaProperty";
import type { NewExpression } from "./expressions/NewExpression";
import type { NoSubstitutionTemplateLiteral } from "./expressions/NoSubstitutionTemplateLiteral";
import type { NonNullChain } from "./expressions/NonNullChain";
import type { NonNullExpression } from "./expressions/NonNullExpression";
import type { NumericLiteral } from "./expressions/NumericLiteral";
import type { ObjectBindingPattern } from "./expressions/ObjectBindingPattern";
import type { ObjectLiteralExpression } from "./expressions/ObjectLiteralExpression";
import type { OmittedExpression } from "./expressions/OmittedExpression";
import type { ParenthesizedExpression } from "./expressions/ParenthesizedExpression";
import type { PostfixUnaryExpression } from "./expressions/PostfixUnaryExpression";
import type { PrefixUnaryExpression } from "./expressions/PrefixUnaryExpression";
import type { PropertyAccessChain } from "./expressions/PropertyAccessChain";
import type { PropertyAccessExpression } from "./expressions/PropertyAccessExpression";
import type { PropertyAssignment } from "./expressions/PropertyAssignment";
import type { RegularExpressionLiteral } from "./expressions/RegularExpressionLiteral";
import type { SatisfiesExpression } from "./expressions/SatisfiesExpression";
import type { ShorthandPropertyAssignment } from "./expressions/ShorthandPropertyAssignment";
import type { SpreadAssignment } from "./expressions/SpreadAssignment";
import type { SpreadElement } from "./expressions/SpreadElement";
import type { StringLiteral } from "./expressions/StringLiteral";
import type { TaggedTemplateExpression } from "./expressions/TaggedTemplateExpression";
import type { TemplateExpression } from "./expressions/TemplateExpression";
import type { TemplateHead } from "./expressions/TemplateHead";
import type { TemplateMiddle } from "./expressions/TemplateMiddle";
import type { TemplateSpan } from "./expressions/TemplateSpan";
import type { TemplateTail } from "./expressions/TemplateTail";
import type { TypeAssertion } from "./expressions/TypeAssertion";
import type { TypeOfExpression } from "./expressions/TypeOfExpression";
import type { VoidExpression } from "./expressions/VoidExpression";
import type { YieldExpression } from "./expressions/YieldExpression";
import type { SourceFile } from "./file/SourceFile";
import type { ExportAssignment } from "./imports/ExportAssignment";
import type { ExportDeclaration } from "./imports/ExportDeclaration";
import type { ExportSpecifier } from "./imports/ExportSpecifier";
import type { ImportClause } from "./imports/ImportClause";
import type { ImportDeclaration } from "./imports/ImportDeclaration";
import type { ImportSpecifier } from "./imports/ImportSpecifier";
import type { NamedExports } from "./imports/NamedExports";
import type { NamedImports } from "./imports/NamedImports";
import type { NamespaceExport } from "./imports/NamespaceExport";
import type { NamespaceImport } from "./imports/NamespaceImport";
import type { Decorator } from "./names/Decorator";
import type { Identifier } from "./names/Identifier";
import type { PrivateIdentifier } from "./names/PrivateIdentifier";
import type { QualifiedName } from "./names/QualifiedName";
import type { Token } from "./names/Token";
import type { Block } from "./statements/Block";
import type { BreakStatement } from "./statements/BreakStatement";
import type { CaseBlock } from "./statements/CaseBlock";
import type { CaseClause } from "./statements/CaseClause";
import type { CatchClause } from "./statements/CatchClause";
import type { ContinueStatement } from "./statements/ContinueStatement";
import type { DebuggerStatement } from "./statements/DebuggerStatement";
import type { DefaultClause } from "./statements/DefaultClause";
import type { DoStatement } from "./statements/DoStatement";
import type { EmptyStatement } from "./statements/EmptyStatement";
import type { ExpressionStatement } from "./statements/ExpressionStatement";
import type { ForInStatement } from "./statements/ForInStatement";
import type { ForOfStatement } from "./statements/ForOfStatement";
import type { ForStatement } from "./statements/ForStatement";
import type { IfStatement } from "./statements/IfStatement";
import type { LabeledStatement } from "./statements/LabeledStatement";
import type { ReturnStatement } from "./statements/ReturnStatement";
import type { SwitchStatement } from "./statements/SwitchStatement";
import type { ThrowStatement } from "./statements/ThrowStatement";
import type { TryStatement } from "./statements/TryStatement";
import type { VariableDeclaration } from "./statements/VariableDeclaration";
import type { VariableDeclarationList } from "./statements/VariableDeclarationList";
import type { VariableStatement } from "./statements/VariableStatement";
import type { WhileStatement } from "./statements/WhileStatement";
import type { WithStatement } from "./statements/WithStatement";
import type { ArrayTypeNode } from "./types/ArrayTypeNode";
import type { CallSignatureDeclaration } from "./types/CallSignatureDeclaration";
import type { ConditionalTypeNode } from "./types/ConditionalTypeNode";
import type { ConstructSignatureDeclaration } from "./types/ConstructSignatureDeclaration";
import type { ConstructorTypeNode } from "./types/ConstructorTypeNode";
import type { ExpressionWithTypeArguments } from "./types/ExpressionWithTypeArguments";
import type { FunctionTypeNode } from "./types/FunctionTypeNode";
import type { ImportTypeNode } from "./types/ImportTypeNode";
import type { IndexSignatureDeclaration } from "./types/IndexSignatureDeclaration";
import type { IndexedAccessTypeNode } from "./types/IndexedAccessTypeNode";
import type { InferTypeNode } from "./types/InferTypeNode";
import type { IntersectionTypeNode } from "./types/IntersectionTypeNode";
import type { KeywordTypeNode } from "./types/KeywordTypeNode";
import type { LiteralTypeNode } from "./types/LiteralTypeNode";
import type { MappedTypeNode } from "./types/MappedTypeNode";
import type { MethodSignature } from "./types/MethodSignature";
import type { NamedTupleMember } from "./types/NamedTupleMember";
import type { OptionalTypeNode } from "./types/OptionalTypeNode";
import type { ParenthesizedTypeNode } from "./types/ParenthesizedTypeNode";
import type { PropertySignature } from "./types/PropertySignature";
import type { RestTypeNode } from "./types/RestTypeNode";
import type { TemplateLiteralTypeNode } from "./types/TemplateLiteralTypeNode";
import type { TemplateLiteralTypeSpan } from "./types/TemplateLiteralTypeSpan";
import type { ThisTypeNode } from "./types/ThisTypeNode";
import type { TupleTypeNode } from "./types/TupleTypeNode";
import type { TypeLiteralNode } from "./types/TypeLiteralNode";
import type { TypeOperatorNode } from "./types/TypeOperatorNode";
import type { TypeParameterDeclaration } from "./types/TypeParameterDeclaration";
import type { TypePredicateNode } from "./types/TypePredicateNode";
import type { TypeQueryNode } from "./types/TypeQueryNode";
import type { TypeReferenceNode } from "./types/TypeReferenceNode";
import type { UnionTypeNode } from "./types/UnionTypeNode";

/**
 * Every AST node produced by {@link factory}: the discriminated union over all
 * node kinds, narrowed by the `kind` tag.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type Node =
  | ArrayBindingPattern
  | ArrayLiteralExpression
  | ArrayTypeNode
  | ArrowFunction
  | AsExpression
  | AwaitExpression
  | BigIntLiteral
  | BinaryExpression
  | BindingElement
  | Block
  | BreakStatement
  | CallChain
  | CallExpression
  | CallSignatureDeclaration
  | CaseBlock
  | CaseClause
  | CatchClause
  | ClassDeclaration
  | ClassExpression
  | ClassStaticBlockDeclaration
  | CommaListExpression
  | ComputedPropertyName
  | ConditionalExpression
  | ConditionalTypeNode
  | ConstructSignatureDeclaration
  | ConstructorDeclaration
  | ConstructorTypeNode
  | ContinueStatement
  | DebuggerStatement
  | Decorator
  | DefaultClause
  | DeleteExpression
  | DoStatement
  | ElementAccessChain
  | ElementAccessExpression
  | EmptyStatement
  | EnumDeclaration
  | EnumMember
  | ExportAssignment
  | ExportDeclaration
  | ExportSpecifier
  | ExpressionStatement
  | ExpressionWithTypeArguments
  | ExternalModuleReference
  | ForInStatement
  | ForOfStatement
  | ForStatement
  | FunctionDeclaration
  | FunctionExpression
  | FunctionTypeNode
  | GetAccessorDeclaration
  | HeritageClause
  | Identifier
  | IfStatement
  | ImportClause
  | ImportDeclaration
  | ImportEqualsDeclaration
  | ImportSpecifier
  | ImportTypeNode
  | IndexSignatureDeclaration
  | IndexedAccessTypeNode
  | InferTypeNode
  | InterfaceDeclaration
  | IntersectionTypeNode
  | KeywordTypeNode
  | LabeledStatement
  | LiteralTypeNode
  | MappedTypeNode
  | MetaProperty
  | MethodDeclaration
  | MethodSignature
  | ModuleBlock
  | ModuleDeclaration
  | NamedExports
  | NamedImports
  | NamedTupleMember
  | NamespaceExport
  | NamespaceExportDeclaration
  | NamespaceImport
  | NewExpression
  | NoSubstitutionTemplateLiteral
  | NonNullChain
  | NonNullExpression
  | NumericLiteral
  | ObjectBindingPattern
  | ObjectLiteralExpression
  | OmittedExpression
  | OptionalTypeNode
  | ParameterDeclaration
  | ParenthesizedExpression
  | ParenthesizedTypeNode
  | PostfixUnaryExpression
  | PrefixUnaryExpression
  | PrivateIdentifier
  | PropertyAccessChain
  | PropertyAccessExpression
  | PropertyAssignment
  | PropertyDeclaration
  | PropertySignature
  | QualifiedName
  | RegularExpressionLiteral
  | RestTypeNode
  | ReturnStatement
  | SatisfiesExpression
  | SemicolonClassElement
  | SetAccessorDeclaration
  | ShorthandPropertyAssignment
  | SourceFile
  | SpreadAssignment
  | SpreadElement
  | StringLiteral
  | SwitchStatement
  | TaggedTemplateExpression
  | TemplateExpression
  | TemplateHead
  | TemplateLiteralTypeNode
  | TemplateLiteralTypeSpan
  | TemplateMiddle
  | TemplateSpan
  | TemplateTail
  | ThisTypeNode
  | ThrowStatement
  | Token
  | TryStatement
  | TupleTypeNode
  | TypeAliasDeclaration
  | TypeAssertion
  | TypeLiteralNode
  | TypeOfExpression
  | TypeOperatorNode
  | TypeParameterDeclaration
  | TypePredicateNode
  | TypeQueryNode
  | TypeReferenceNode
  | UnionTypeNode
  | VariableDeclaration
  | VariableDeclarationList
  | VariableStatement
  | VoidExpression
  | WhileStatement
  | WithStatement
  | YieldExpression;
