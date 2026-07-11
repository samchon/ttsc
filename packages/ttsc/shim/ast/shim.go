// gen_shims:hand-maintained
//
// This shim file mixes generated re-exports with hand-written `go:linkname`
// declarations (see GetSourceFileOfNode / GetNodeAtPosition below). gen_shims
// detects the marker on the first line and skips this file. Remove the marker
// only if you are intentionally regenerating and willing to re-add the
// hand-maintained content.

package ast

import (
  innerast "github.com/microsoft/typescript-go/internal/ast"
  _ "unsafe"
)

type CallExpression = innerast.CallExpression
type Diagnostic = innerast.Diagnostic
type Identifier = innerast.Identifier
type IdentifierNode = innerast.IdentifierNode
type ImportAttributesNode = innerast.ImportAttributesNode
type ImportClauseNode = innerast.ImportClauseNode
type ImportPhaseModifierSyntaxKind = innerast.ImportPhaseModifierSyntaxKind
type ImportSpecifierList = innerast.ImportSpecifierList
type IntersectionTypeNode = innerast.IntersectionTypeNode
type Kind = innerast.Kind
type KeywordExpressionSyntaxKind = innerast.KeywordExpressionSyntaxKind
type KeywordTypeSyntaxKind = innerast.KeywordTypeSyntaxKind
type LiteralTypeNode = innerast.LiteralTypeNode
type NoSubstitutionTemplateLiteral = innerast.NoSubstitutionTemplateLiteral
type Node = innerast.Node
type NodeFactory = innerast.NodeFactory
type NodeFactoryHooks = innerast.NodeFactoryHooks
type NodeVisitor = innerast.NodeVisitor
type NodeVisitorHooks = innerast.NodeVisitorHooks
type TokenFlags = innerast.TokenFlags
type ModifierList = innerast.ModifierList
type StatementList = innerast.StatementList
type VariableDeclarationNodeList = innerast.VariableDeclarationNodeList
type BindingElementList = innerast.BindingElementList
type TypeParameterList = innerast.TypeParameterList
type ParameterList = innerast.ParameterList
type ElementList = innerast.ElementList
type TypeList = innerast.TypeList
type TypeElementList = innerast.TypeElementList
type Statement = innerast.Statement
type Expression = innerast.Expression
type TypeNode = innerast.TypeNode
type TypePredicateParameterName = innerast.TypePredicateParameterName
type AssertsKeyword = innerast.AssertsKeyword
type BindingName = innerast.BindingName
type BinaryOperatorToken = innerast.BinaryOperatorToken
type PropertyName = innerast.PropertyName
type MemberName = innerast.MemberName
type EntityName = innerast.EntityName
type ModuleExportName = innerast.ModuleExportName
type NamedImportBindings = innerast.NamedImportBindings
type ConciseBody = innerast.ConciseBody
type TemplateSpanList = innerast.TemplateSpanList
type TemplateMiddleOrTail = innerast.TemplateMiddleOrTail
type TemplateHeadNode = innerast.TemplateHeadNode
type QuestionDotToken = innerast.QuestionDotToken
type QuestionToken = innerast.QuestionToken
type DotDotDotToken = innerast.DotDotDotToken
type ExclamationToken = innerast.ExclamationToken
type EqualsGreaterThanToken = innerast.EqualsGreaterThanToken
type AsteriskToken = innerast.AsteriskToken
type TokenNode = innerast.TokenNode
type TemplateHead = innerast.TemplateHead
type TemplateLiteralTypeNode = innerast.TemplateLiteralTypeNode
type TemplateLiteralTypeSpan = innerast.TemplateLiteralTypeSpan
type TemplateMiddle = innerast.TemplateMiddle
type TemplateTail = innerast.TemplateTail
type PrefixUnaryExpression = innerast.PrefixUnaryExpression
type ComputedPropertyName = innerast.ComputedPropertyName
type PropertySignatureDeclaration = innerast.PropertySignatureDeclaration
type QualifiedName = innerast.QualifiedName
type TypeLiteralNode = innerast.TypeLiteralNode
type FunctionTypeNode = innerast.FunctionTypeNode
type InterfaceDeclaration = innerast.InterfaceDeclaration
type TypeReferenceNode = innerast.TypeReferenceNode
type SourceFile = innerast.SourceFile
type StringLiteral = innerast.StringLiteral
type Symbol = innerast.Symbol
type SymbolFlags = innerast.SymbolFlags
type NumericLiteral = innerast.NumericLiteral
type BigIntLiteral = innerast.BigIntLiteral
type ArrayTypeNode = innerast.ArrayTypeNode
type IndexSignatureDeclaration = innerast.IndexSignatureDeclaration
type NamedTupleMember = innerast.NamedTupleMember
type OptionalTypeNode = innerast.OptionalTypeNode
type RestTypeNode = innerast.RestTypeNode
type TypeAliasDeclaration = innerast.TypeAliasDeclaration
type TypeParameterDeclaration = innerast.TypeParameterDeclaration
type TupleTypeNode = innerast.TupleTypeNode
type UnionTypeNode = innerast.UnionTypeNode
type MethodSignatureDeclaration = innerast.MethodSignatureDeclaration
type MethodDeclaration = innerast.MethodDeclaration
type NodeList = innerast.NodeList
type ParameterDeclaration = innerast.ParameterDeclaration
type ParenthesizedTypeNode = innerast.ParenthesizedTypeNode

const (
  KindEndOfFile                     = innerast.KindEndOfFile
  KindSingleLineCommentTrivia       = innerast.KindSingleLineCommentTrivia
  KindCallExpression                = innerast.KindCallExpression
  KindIdentifier                    = innerast.KindIdentifier
  KindMultiLineCommentTrivia        = innerast.KindMultiLineCommentTrivia
  KindPropertyAccessExpression      = innerast.KindPropertyAccessExpression
  KindPropertySignature             = innerast.KindPropertySignature
  KindComputedPropertyName          = innerast.KindComputedPropertyName
  KindMethodSignature               = innerast.KindMethodSignature
  KindMethodDeclaration             = innerast.KindMethodDeclaration
  KindIndexSignature                = innerast.KindIndexSignature
  KindParameter                     = innerast.KindParameter
  KindStringKeyword                 = innerast.KindStringKeyword
  KindNumberKeyword                 = innerast.KindNumberKeyword
  KindBooleanKeyword                = innerast.KindBooleanKeyword
  KindBigIntKeyword                 = innerast.KindBigIntKeyword
  KindAnyKeyword                    = innerast.KindAnyKeyword
  KindUnknownKeyword                = innerast.KindUnknownKeyword
  KindNeverKeyword                  = innerast.KindNeverKeyword
  KindUndefinedKeyword              = innerast.KindUndefinedKeyword
  KindNullKeyword                   = innerast.KindNullKeyword
  KindVoidKeyword                   = innerast.KindVoidKeyword
  KindTrueKeyword                   = innerast.KindTrueKeyword
  KindFalseKeyword                  = innerast.KindFalseKeyword
  KindStringLiteral                 = innerast.KindStringLiteral
  KindNoSubstitutionTemplateLiteral = innerast.KindNoSubstitutionTemplateLiteral
  KindTemplateHead                  = innerast.KindTemplateHead
  KindTemplateMiddle                = innerast.KindTemplateMiddle
  KindTemplateTail                  = innerast.KindTemplateTail
  KindNumericLiteral                = innerast.KindNumericLiteral
  KindBigIntLiteral                 = innerast.KindBigIntLiteral
  KindTypeReference                 = innerast.KindTypeReference
  KindFunctionType                  = innerast.KindFunctionType
  KindLiteralType                   = innerast.KindLiteralType
  KindArrayType                     = innerast.KindArrayType
  KindTypeLiteral                   = innerast.KindTypeLiteral
  KindInterfaceDeclaration          = innerast.KindInterfaceDeclaration
  KindTupleType                     = innerast.KindTupleType
  KindUnionType                     = innerast.KindUnionType
  KindIntersectionType              = innerast.KindIntersectionType
  KindNamedTupleMember              = innerast.KindNamedTupleMember
  KindOptionalType                  = innerast.KindOptionalType
  KindParenthesizedType             = innerast.KindParenthesizedType
  KindRestType                      = innerast.KindRestType
  KindTemplateLiteralType           = innerast.KindTemplateLiteralType
  KindTemplateLiteralTypeSpan       = innerast.KindTemplateLiteralTypeSpan
  KindPrefixUnaryExpression         = innerast.KindPrefixUnaryExpression
  KindQualifiedName                 = innerast.KindQualifiedName
  KindTypeAliasDeclaration          = innerast.KindTypeAliasDeclaration
  KindTypeParameter                 = innerast.KindTypeParameter
  KindImportSpecifier               = innerast.KindImportSpecifier
  KindImportDeclaration             = innerast.KindImportDeclaration
  KindNamedImports                  = innerast.KindNamedImports
  KindNamespaceImport               = innerast.KindNamespaceImport
  KindExportSpecifier               = innerast.KindExportSpecifier
  KindModuleBlock                   = innerast.KindModuleBlock
  KindModuleDeclaration             = innerast.KindModuleDeclaration
  KindFunctionDeclaration           = innerast.KindFunctionDeclaration
  KindMinusToken                    = innerast.KindMinusToken
  KindQuestionDotToken              = innerast.KindQuestionDotToken
  KindAssertsKeyword                = innerast.KindAssertsKeyword
  KindEqualsGreaterThanToken        = innerast.KindEqualsGreaterThanToken

  NodeFlagsOptionalChain = innerast.NodeFlagsOptionalChain

  TokenFlagsNone = innerast.TokenFlagsNone

  SymbolFlagsOptional  = innerast.SymbolFlagsOptional
  SymbolFlagsAlias     = innerast.SymbolFlagsAlias
  SymbolFlagsType      = innerast.SymbolFlagsType
  SymbolFlagsNamespace = innerast.SymbolFlagsNamespace

  ModifierFlagsPrivate   = innerast.ModifierFlagsPrivate
  ModifierFlagsProtected = innerast.ModifierFlagsProtected
  ModifierFlagsReadonly  = innerast.ModifierFlagsReadonly
)

// OperatorPrecedence members. The complete family is re-exported by hand so
// precedence comparisons (e.g. a lint fixer deciding whether a spliced
// replacement must be parenthesized) can name every level of the
// OperatorPrecedence type aliased in surface.go; a partial re-export would
// trip the shim_audit zero-tolerance enum gate.
const (
  OperatorPrecedenceComma          = innerast.OperatorPrecedenceComma
  OperatorPrecedenceSpread         = innerast.OperatorPrecedenceSpread
  OperatorPrecedenceYield          = innerast.OperatorPrecedenceYield
  OperatorPrecedenceAssignment     = innerast.OperatorPrecedenceAssignment
  OperatorPrecedenceConditional    = innerast.OperatorPrecedenceConditional
  OperatorPrecedenceLogicalOR      = innerast.OperatorPrecedenceLogicalOR
  OperatorPrecedenceLogicalAND     = innerast.OperatorPrecedenceLogicalAND
  OperatorPrecedenceBitwiseOR      = innerast.OperatorPrecedenceBitwiseOR
  OperatorPrecedenceBitwiseXOR     = innerast.OperatorPrecedenceBitwiseXOR
  OperatorPrecedenceBitwiseAND     = innerast.OperatorPrecedenceBitwiseAND
  OperatorPrecedenceEquality       = innerast.OperatorPrecedenceEquality
  OperatorPrecedenceRelational     = innerast.OperatorPrecedenceRelational
  OperatorPrecedenceShift          = innerast.OperatorPrecedenceShift
  OperatorPrecedenceAdditive       = innerast.OperatorPrecedenceAdditive
  OperatorPrecedenceMultiplicative = innerast.OperatorPrecedenceMultiplicative
  OperatorPrecedenceExponentiation = innerast.OperatorPrecedenceExponentiation
  OperatorPrecedenceUnary          = innerast.OperatorPrecedenceUnary
  OperatorPrecedenceUpdate         = innerast.OperatorPrecedenceUpdate
  OperatorPrecedenceLeftHandSide   = innerast.OperatorPrecedenceLeftHandSide
  OperatorPrecedenceOptionalChain  = innerast.OperatorPrecedenceOptionalChain
  OperatorPrecedenceMember         = innerast.OperatorPrecedenceMember
  OperatorPrecedencePrimary        = innerast.OperatorPrecedencePrimary
  OperatorPrecedenceParentheses    = innerast.OperatorPrecedenceParentheses
  OperatorPrecedenceLowest         = innerast.OperatorPrecedenceLowest
  OperatorPrecedenceHighest        = innerast.OperatorPrecedenceHighest
  OperatorPrecedenceDisallowComma  = innerast.OperatorPrecedenceDisallowComma
  OperatorPrecedenceCoalesce       = innerast.OperatorPrecedenceCoalesce
  OperatorPrecedenceInvalid        = innerast.OperatorPrecedenceInvalid
)

// NewNodeFactory creates an AST node factory with the supplied creation hooks.
// Pass a zero-value NodeFactoryHooks to get the default factory behaviour.
func NewNodeFactory(options NodeFactoryHooks) *NodeFactory {
  return innerast.NewNodeFactory(options)
}

// NewNodeVisitor creates a visitor that calls visit for each node encountered
// during a tree walk, delegating node recreation to factory using hooks.
func NewNodeVisitor(visit func(node *Node) *Node, factory *NodeFactory, options NodeVisitorHooks) *NodeVisitor {
  return innerast.NewNodeVisitor(visit, factory, options)
}

// GetCombinedModifierFlags returns syntactic modifiers combined across wrappers
// such as variable statements and their declaration lists.
func GetCombinedModifierFlags(node *Node) ModifierFlags {
  return innerast.GetCombinedModifierFlags(node)
}

// GetExpressionPrecedence returns the operator precedence of an expression
// node — the level at which it binds relative to a surrounding expression.
// Callers compare it against an OperatorPrecedence floor to decide whether a
// textual splice of the expression into a new position needs parentheses.
func GetExpressionPrecedence(expression *Expression) OperatorPrecedence {
  return innerast.GetExpressionPrecedence(expression)
}

// IsFunctionLike reports whether node is any function-like construct
// (function declaration, arrow function, method, constructor, accessor, etc.).
func IsFunctionLike(node *Node) bool {
  return innerast.IsFunctionLike(node)
}

// IsPropertyAssignment reports whether node is a key:value pair inside an
// object literal expression.
func IsPropertyAssignment(node *Node) bool {
  return innerast.IsPropertyAssignment(node)
}

// IsPropertyDeclaration reports whether node is a class property declaration.
func IsPropertyDeclaration(node *Node) bool {
  return innerast.IsPropertyDeclaration(node)
}

// IsModuleBlock reports whether node is the body block of a namespace or
// module declaration.
func IsModuleBlock(node *Node) bool {
  return innerast.IsModuleBlock(node)
}

// IsStringLiteral reports whether node is a string literal token.
func IsStringLiteral(node *Node) bool {
  return innerast.IsStringLiteral(node)
}

// IsPropertyAccessExpression reports whether node is a dotted member access
// (e.g. `a.b`).
func IsPropertyAccessExpression(node *Node) bool {
  return innerast.IsPropertyAccessExpression(node)
}

// IsElementAccessExpression reports whether node is a bracket member access
// (e.g. `a[b]`).
func IsElementAccessExpression(node *Node) bool {
  return innerast.IsElementAccessExpression(node)
}

// GetSourceFileOfNode walks up the parent chain to return the SourceFile that
// owns the given node. Linked from the internal package via go:linkname because
// the function is unexported there.
//
//go:linkname GetSourceFileOfNode github.com/microsoft/typescript-go/internal/ast.GetSourceFileOfNode
func GetSourceFileOfNode(node *innerast.Node) *innerast.SourceFile

// GetNodeAtPosition returns the deepest AST node whose range covers position
// in file. When includeJSDoc is true the search descends into JSDoc sub-trees.
// Linked from the internal package via go:linkname.
//
//go:linkname GetNodeAtPosition github.com/microsoft/typescript-go/internal/ast.GetNodeAtPosition
func GetNodeAtPosition(file *innerast.SourceFile, position int, includeJSDoc bool) *innerast.Node
