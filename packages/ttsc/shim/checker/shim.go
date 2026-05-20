// gen_shims:hand-maintained
//
// This shim file mixes generated re-exports with hand-written `go:linkname`
// declarations targeting unexported `*Checker` methods that the @ttsc/lint
// engine relies on. gen_shims detects the marker on the first line and skips
// this file. Remove the marker only if you are intentionally regenerating and
// willing to re-add the hand-maintained content.

package checker

import (
  innerast "github.com/microsoft/typescript-go/internal/ast"
  innerchecker "github.com/microsoft/typescript-go/internal/checker"
  _ "unsafe"
)

type Checker = innerchecker.Checker
type IndexInfo = innerchecker.IndexInfo
type Signature = innerchecker.Signature
type SignatureKind = innerchecker.SignatureKind
type Type = innerchecker.Type
type TypeFlags = innerchecker.TypeFlags
type ObjectFlags = innerchecker.ObjectFlags
type ElementFlags = innerchecker.ElementFlags

const (
  SignatureKindCall = innerchecker.SignatureKindCall

  TypeFlagsAny             = innerchecker.TypeFlagsAny
  TypeFlagsUnknown         = innerchecker.TypeFlagsUnknown
  TypeFlagsUndefined       = innerchecker.TypeFlagsUndefined
  TypeFlagsNull            = innerchecker.TypeFlagsNull
  TypeFlagsVoid            = innerchecker.TypeFlagsVoid
  TypeFlagsNever           = innerchecker.TypeFlagsNever
  TypeFlagsObject          = innerchecker.TypeFlagsObject
  TypeFlagsTemplateLiteral = innerchecker.TypeFlagsTemplateLiteral
  TypeFlagsStringMapping   = innerchecker.TypeFlagsStringMapping
  TypeFlagsUnion           = innerchecker.TypeFlagsUnion
  TypeFlagsIntersection    = innerchecker.TypeFlagsIntersection
  TypeFlagsLiteral         = innerchecker.TypeFlagsLiteral
  TypeFlagsStringLiteral   = innerchecker.TypeFlagsStringLiteral
  TypeFlagsNumberLiteral   = innerchecker.TypeFlagsNumberLiteral
  TypeFlagsBigIntLiteral   = innerchecker.TypeFlagsBigIntLiteral
  TypeFlagsBooleanLiteral  = innerchecker.TypeFlagsBooleanLiteral
  TypeFlagsStringLike      = innerchecker.TypeFlagsStringLike
  TypeFlagsNumberLike      = innerchecker.TypeFlagsNumberLike
  TypeFlagsBigIntLike      = innerchecker.TypeFlagsBigIntLike
  TypeFlagsBooleanLike     = innerchecker.TypeFlagsBooleanLike

  ObjectFlagsReference        = innerchecker.ObjectFlagsReference
  ObjectFlagsClass            = innerchecker.ObjectFlagsClass
  ObjectFlagsInterface        = innerchecker.ObjectFlagsInterface
  ObjectFlagsClassOrInterface = innerchecker.ObjectFlagsClassOrInterface

  ElementFlagsNone     = innerchecker.ElementFlagsNone
  ElementFlagsRequired = innerchecker.ElementFlagsRequired
  ElementFlagsOptional = innerchecker.ElementFlagsOptional
  ElementFlagsRest     = innerchecker.ElementFlagsRest
  ElementFlagsVariadic = innerchecker.ElementFlagsVariadic
)

// IsTupleType reports whether t is a fixed-length tuple type.
func IsTupleType(t *innerchecker.Type) bool {
  return innerchecker.IsTupleType(t)
}

// Checker_getIndexInfosOfType returns the index signatures (string/number/symbol
// index infos) declared on t.
func Checker_getIndexInfosOfType(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.IndexInfo {
  return recv.GetIndexInfosOfType(t)
}

// Checker_getPropertiesOfType returns the named property symbols of t. For
// union and intersection types this is the set of properties visible on every
// member.
func Checker_getPropertiesOfType(recv *innerchecker.Checker, t *innerchecker.Type) []*innerast.Symbol {
  return recv.GetPropertiesOfType(t)
}

// Checker_getApparentProperties returns the properties visible on t after
// resolving primitive wrapper types (e.g. string → String).
func Checker_getApparentProperties(recv *innerchecker.Checker, t *innerchecker.Type) []*innerast.Symbol {
  return recv.GetApparentProperties(t)
}

// Checker_getTypeArguments returns the type arguments of a generic reference
// type, or nil when t is not a reference.
func Checker_getTypeArguments(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.Type {
  return recv.GetTypeArguments(t)
}

// Checker_getTypeOfSymbol returns the declared type of symbol, resolving
// aliases and following late-bound types.
func Checker_getTypeOfSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerchecker.Type {
  return recv.GetTypeOfSymbol(symbol)
}

// Checker_getTypeOfSymbolAtLocation returns the contextual type of symbol as
// observed at the given AST node (useful for narrowed types in control flow).
func Checker_getTypeOfSymbolAtLocation(recv *innerchecker.Checker, symbol *innerast.Symbol, node *innerast.Node) *innerchecker.Type {
  return recv.GetTypeOfSymbolAtLocation(symbol, node)
}

// Checker_getTypeOfPropertyOfType looks up the type of the named property on t
// and returns nil when no such property exists.
func Checker_getTypeOfPropertyOfType(recv *innerchecker.Checker, t *innerchecker.Type, name string) *innerchecker.Type {
  return recv.GetTypeOfPropertyOfType(t, name)
}

//go:linkname checkerGetAliasSymbolForTypeNode github.com/microsoft/typescript-go/internal/checker.(*Checker).getAliasSymbolForTypeNode
func checkerGetAliasSymbolForTypeNode(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol

// Checker_getAliasSymbolForTypeNode returns the alias symbol that a type node
// refers to when the node is itself a type alias reference (e.g. `type Foo = ...`).
func Checker_getAliasSymbolForTypeNode(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol {
  return checkerGetAliasSymbolForTypeNode(recv, node)
}

//go:linkname checkerGetDeclarationOfAliasSymbol github.com/microsoft/typescript-go/internal/checker.(*Checker).getDeclarationOfAliasSymbol
func checkerGetDeclarationOfAliasSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Node

// Checker_getDeclarationOfAliasSymbol resolves an import/export alias symbol to
// its original declaration node.
func Checker_getDeclarationOfAliasSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Node {
  return checkerGetDeclarationOfAliasSymbol(recv, symbol)
}

//go:linkname checkerGetTargetOfImportSpecifier github.com/microsoft/typescript-go/internal/checker.(*Checker).getTargetOfImportSpecifier
func checkerGetTargetOfImportSpecifier(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol

// Checker_getTargetOfImportSpecifier resolves an import specifier node to the
// exported symbol it binds. Returns nil if recv or node is nil.
func Checker_getTargetOfImportSpecifier(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol {
  if recv == nil || node == nil {
    return nil
  }
  return checkerGetTargetOfImportSpecifier(recv, node)
}

// Checker_getAliasedSymbol follows an alias chain to its final target symbol.
// Returns nil if recv or symbol is nil.
func Checker_getAliasedSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Symbol {
  if recv == nil || symbol == nil {
    return nil
  }
  return recv.GetAliasedSymbol(symbol)
}

//go:linkname checkerResolveEntityName github.com/microsoft/typescript-go/internal/checker.(*Checker).resolveEntityName
func checkerResolveEntityName(
  recv *innerchecker.Checker,
  name *innerast.Node,
  meaning innerast.SymbolFlags,
  ignoreErrors bool,
  dontResolveAlias bool,
  location *innerast.Node,
) *innerast.Symbol

// Checker_resolveEntityName resolves a dotted entity name (identifier or
// qualified name) to the symbol it denotes, filtered by meaning flags.
// When ignoreErrors is true, resolution failures are silent. When
// dontResolveAlias is true, the returned symbol may still be an alias.
// Returns nil if recv or name is nil.
func Checker_resolveEntityName(
  recv *innerchecker.Checker,
  name *innerast.Node,
  meaning innerast.SymbolFlags,
  ignoreErrors bool,
  dontResolveAlias bool,
  location *innerast.Node,
) *innerast.Symbol {
  if recv == nil || name == nil {
    return nil
  }
  return checkerResolveEntityName(recv, name, meaning, ignoreErrors, dontResolveAlias, location)
}

//go:linkname checkerGetTypeNameSymbol github.com/microsoft/typescript-go/internal/checker.getTypeNameSymbol
func checkerGetTypeNameSymbol(t *innerchecker.Type) *innerast.Symbol

// Type_getTypeNameSymbol returns the symbol attached to t's type name field,
// or nil when t has no name symbol or t is nil. Linked via go:linkname because
// getTypeNameSymbol is a package-level unexported function in the checker.
func Type_getTypeNameSymbol(t *innerchecker.Type) *innerast.Symbol {
  if t == nil {
    return nil
  }
  return checkerGetTypeNameSymbol(t)
}

//go:linkname checkerIsArrayType github.com/microsoft/typescript-go/internal/checker.(*Checker).isArrayType
func checkerIsArrayType(recv *innerchecker.Checker, t *innerchecker.Type) bool

// Checker_isArrayType reports whether t is the built-in Array<T> reference type.
func Checker_isArrayType(recv *innerchecker.Checker, t *innerchecker.Type) bool {
  return checkerIsArrayType(recv, t)
}

//go:linkname checkerGetBaseTypes github.com/microsoft/typescript-go/internal/checker.(*Checker).getBaseTypes
func checkerGetBaseTypes(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.Type

// Checker_getBaseTypes returns the list of base types (from `extends` clauses)
// for a class or interface type. Returns nil if recv or t is nil.
func Checker_getBaseTypes(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.Type {
  if recv == nil || t == nil {
    return nil
  }
  return checkerGetBaseTypes(recv, t)
}
