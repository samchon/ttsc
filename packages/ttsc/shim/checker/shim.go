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
  innerdiagnostics "github.com/microsoft/typescript-go/internal/diagnostics"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
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

//go:linkname checkerGetRegularTypeOfLiteralType github.com/microsoft/typescript-go/internal/checker.(*Checker).getRegularTypeOfLiteralType
func checkerGetRegularTypeOfLiteralType(recv *innerchecker.Checker, t *innerchecker.Type) *innerchecker.Type

// Checker_getRegularTypeOfLiteralType returns the canonical regular form of a
// literal type. TypeScript's checker uses this before comparing switch case
// types because a source literal's fresh type and a union member's regular type
// denote the same runtime value but have different pointers.
func Checker_getRegularTypeOfLiteralType(recv *innerchecker.Checker, t *innerchecker.Type) *innerchecker.Type {
  if recv == nil || t == nil {
    return t
  }
  return checkerGetRegularTypeOfLiteralType(recv, t)
}

// Checker_typeToStringFullyQualified formats a type with the same stable,
// alias-aware flags TypeScript uses in diagnostics that name union members.
// Keeping the flag bundle inside the shim avoids leaking checker-internal enum
// types through consumer code.
func Checker_typeToStringFullyQualified(recv *innerchecker.Checker, t *innerchecker.Type, enclosingDeclaration *innerast.Node) string {
  if recv == nil || t == nil {
    return ""
  }
  return recv.TypeToStringEx(
    t,
    enclosingDeclaration,
    innerchecker.TypeFormatFlagsAllowUniqueESSymbolType|
      innerchecker.TypeFormatFlagsUseAliasDefinedOutsideCurrentScope|
      innerchecker.TypeFormatFlagsUseFullyQualifiedType,
    nil,
  )
}

// Checker_symbolToValueString formats a symbol as a value-position expression
// at enclosingDeclaration. AllowAnyNodeKind lets the checker emit indexed
// access for enum members whose names cannot use dot notation.
func Checker_symbolToValueString(recv *innerchecker.Checker, symbol *innerast.Symbol, enclosingDeclaration *innerast.Node) string {
  if recv == nil || symbol == nil {
    return ""
  }
  return recv.SymbolToStringEx(
    symbol,
    enclosingDeclaration,
    innerast.SymbolFlagsValue,
    innerchecker.SymbolFormatFlagsAllowAnyNodeKind,
  )
}

// Checker_isSymbolAccessibleAsValue verifies that SymbolToStringEx can name a
// symbol from enclosingDeclaration. Unlike GetAccessibleSymbolChain, the
// checker also follows containing enum, class, and namespace symbols, so a
// qualified member such as Domain.Mode.Done is accepted when its container is
// visible.
func Checker_isSymbolAccessibleAsValue(recv *innerchecker.Checker, symbol *innerast.Symbol, enclosingDeclaration *innerast.Node) bool {
  if recv == nil || symbol == nil || enclosingDeclaration == nil {
    return false
  }
  result := recv.IsSymbolAccessible(
    symbol,
    enclosingDeclaration,
    innerast.SymbolFlagsValue,
    false,
  )
  return result.Accessibility == innerprinter.SymbolAccessibilityAccessible
}

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
  TypeFlagsEnum            = innerchecker.TypeFlagsEnum
  TypeFlagsEnumLiteral     = innerchecker.TypeFlagsEnumLiteral
  TypeFlagsEnumLike        = innerchecker.TypeFlagsEnumLike

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
// resolving primitive wrapper types (e.g. string to String).
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

//go:linkname checkerGetPropertyNameForKnownSymbolName github.com/microsoft/typescript-go/internal/checker.(*Checker).getPropertyNameForKnownSymbolName
func checkerGetPropertyNameForKnownSymbolName(recv *innerchecker.Checker, symbolName string) string

// Checker_getPropertyNameForKnownSymbolName returns the late-bound property
// name the checker uses for a member keyed by the global well-known symbol
// `Symbol.<symbolName>` (e.g. "asyncIterator", "asyncDispose", "iterator").
// It resolves the unique-symbol type of that property on the global
// `SymbolConstructor` — including lib-provided and `declare global` augmented
// members — so `(*Checker).GetPropertyOfType(t, name)` with the returned name
// finds exactly the members declared as `[Symbol.<symbolName>]`. This is the
// same resolution the checker itself performs when it validates `for await`
// iterability, which is why a lint rule that mirrors typescript-eslint's
// well-known-symbol protocol checks must go through it instead of matching
// property-name text. When the global `Symbol` constructor lacks the member,
// the checker's internal fallback name (a `\xFE@`-prefixed string no
// source-declared property can late-bind to) is returned, so lookups simply
// find nothing. Returns "" if recv is nil.
func Checker_getPropertyNameForKnownSymbolName(recv *innerchecker.Checker, symbolName string) string {
  if recv == nil {
    return ""
  }
  return checkerGetPropertyNameForKnownSymbolName(recv, symbolName)
}

//go:linkname checkerGetIterationTypeOfIterable github.com/microsoft/typescript-go/internal/checker.(*Checker).getIterationTypeOfIterable
func checkerGetIterationTypeOfIterable(
  recv *innerchecker.Checker,
  use innerchecker.IterationUse,
  typeKind innerchecker.IterationTypeKind,
  inputType *innerchecker.Type,
  errorNode *innerast.Node,
) *innerchecker.Type

// Checker_getSynchronousIterationYieldType returns the value type produced by
// inputType's checked `[Symbol.iterator]` protocol. It delegates to the same
// TypeScript-Go traversal used for synchronous iteration, including inherited
// and structural iterables, instantiated iterator returns, intersections, and
// primitive strings. A nil result means the checker could not derive a valid
// synchronous iteration type. Diagnostics are intentionally disabled because
// callers use this as a type query after normal TypeScript checking.
func Checker_getSynchronousIterationYieldType(recv *innerchecker.Checker, inputType *innerchecker.Type) *innerchecker.Type {
  if recv == nil || inputType == nil {
    return nil
  }
  return checkerGetIterationTypeOfIterable(
    recv,
    innerchecker.IterationUseElement,
    innerchecker.IterationTypeKindYield,
    inputType,
    nil,
  )
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

// Checker_getExportsOfModule returns the exported symbols of a source-file or
// namespace module symbol, resolving export-star aggregation the same way the
// checker does for emit and services.
func Checker_getExportsOfModule(recv *innerchecker.Checker, symbol *innerast.Symbol) []*innerast.Symbol {
  if recv == nil || symbol == nil {
    return nil
  }
  return recv.GetExportsOfModule(symbol)
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

//go:linkname checkerGetDeclaredTypeOfSymbol github.com/microsoft/typescript-go/internal/checker.(*Checker).getDeclaredTypeOfSymbol
func checkerGetDeclaredTypeOfSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerchecker.Type

// Checker_getDeclaredTypeOfSymbol returns the declared (instance) type of a
// class or interface symbol. Unlike Checker_getTypeOfSymbol, which yields the
// constructor (static) type of a class symbol, the result IS a
// ClassOrInterface type and is therefore safe to feed back into
// Checker_getBaseTypes. This lets a consumer resolve a generic base's symbol to
// its declared type and keep walking the base chain past the generic boundary
// where getBaseTypes would otherwise dead-end (a Reference/Anonymous type has a
// nil AsInterfaceType()). Returns nil if recv or symbol is nil.
func Checker_getDeclaredTypeOfSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerchecker.Type {
  if recv == nil || symbol == nil {
    return nil
  }
  return checkerGetDeclaredTypeOfSymbol(recv, symbol)
}

//go:linkname checkerGetMinArgumentCount github.com/microsoft/typescript-go/internal/checker.(*Checker).getMinArgumentCount
func checkerGetMinArgumentCount(recv *innerchecker.Checker, signature *innerchecker.Signature) int

// Checker_getMinArgumentCount returns the minimum number of required arguments
// a call/construct signature accepts (parameters before the first optional or
// rest parameter). A type-transform plugin uses this to gate the single-
// required-parameter constructor strategy (`new C(x)`) and single-arg static
// factory (`C.from(x)`). Returns 0 if recv or signature is nil.
func Checker_getMinArgumentCount(recv *innerchecker.Checker, signature *innerchecker.Signature) int {
  if recv == nil || signature == nil {
    return 0
  }
  return checkerGetMinArgumentCount(recv, signature)
}

// Checker_getSignaturesOfType returns the call or construct signatures declared
// on t, selected by kind (SignatureKindCall / SignatureKindConstruct). This is
// the producer companion to Checker_getMinArgumentCount and
// Checker_getReturnTypeOfSignature: without it the *Signature those two consume
// could not be obtained. A type-transform plugin uses the construct signatures
// of a class's constructor type to detect the `new C(x)` strategy and the call
// signatures of a static `from` member to detect the `C.from(x)` strategy.
// Returns nil if recv or t is nil.
func Checker_getSignaturesOfType(recv *innerchecker.Checker, t *innerchecker.Type, kind innerchecker.SignatureKind) []*innerchecker.Signature {
  if recv == nil || t == nil {
    return nil
  }
  return recv.GetSignaturesOfType(t, kind)
}

//go:linkname checkerResolveCall github.com/microsoft/typescript-go/internal/checker.(*Checker).resolveCall
func checkerResolveCall(
  recv *innerchecker.Checker,
  node *innerast.Node,
  signatures []*innerchecker.Signature,
  candidatesOutArray *[]*innerchecker.Signature,
  checkMode innerchecker.CheckMode,
  callChainFlags innerchecker.SignatureFlags,
  headMessage *innerdiagnostics.Message,
) *innerchecker.Signature

// Checker_resolveCallSignatures selects the signature applicable to an
// existing call expression from the supplied candidates. It delegates argument
// compatibility, overload ordering, and generic inference to the same resolver
// TypeScript uses for ordinary calls. The candidates output suppresses duplicate
// compiler diagnostics; callers use the selected signature only for type queries.
// Returns nil if recv, node, or signatures are absent.
func Checker_resolveCallSignatures(
  recv *innerchecker.Checker,
  node *innerast.Node,
  signatures []*innerchecker.Signature,
) *innerchecker.Signature {
  if recv == nil || node == nil || len(signatures) == 0 {
    return nil
  }
  var candidates []*innerchecker.Signature
  // Upstream defines normal checking and no call-chain flags as the zero values.
  // Avoid selecting individual private enum members into the public shim surface.
  var checkMode innerchecker.CheckMode
  var callChainFlags innerchecker.SignatureFlags
  return checkerResolveCall(
    recv,
    node,
    signatures,
    &candidates,
    checkMode,
    callChainFlags,
    nil,
  )
}

// Checker_getReturnTypeOfSignature returns the return type of signature, used to
// verify that a static `from(x)` factory actually returns the class instance
// type before selecting the `C.from(x)` construction strategy. Returns nil if
// recv or signature is nil.
func Checker_getReturnTypeOfSignature(recv *innerchecker.Checker, signature *innerchecker.Signature) *innerchecker.Type {
  if recv == nil || signature == nil {
    return nil
  }
  return recv.GetReturnTypeOfSignature(signature)
}

// Signature_parameterCount returns the number of declared value parameters of a
// call/construct signature. A rest parameter counts as one and the `this`
// parameter is excluded (it is held separately from the value parameters).
//
// Checker_getMinArgumentCount alone cannot tell a zero-parameter signature
// (`()` minimum 0) from a single-optional-parameter one (`(x?)` also
// minimum 0). A type-transform plugin needs that distinction to replicate the
// type-level "single meaningful argument" rule: a FIRST parameter must exist
// and every later parameter must be optional or rest, as
// `Signature_parameterCount(sig) >= 1 && Checker_getMinArgumentCount(c, sig) <= 1`.
// Without it the `new C(x)` / `C.from(x)` strategies silently fall back to field
// copy for every optional-first constructor or factory. Returns 0 if signature
// is nil.
func Signature_parameterCount(signature *innerchecker.Signature) int {
  if signature == nil {
    return 0
  }
  return len(signature.Parameters())
}

// Signature_parameters returns the declared value-parameter symbols of a
// call/construct signature, in declaration order, excluding the synthetic
// `this` parameter. The first element is the seed parameter of a `new C(seed)`
// constructor or a `C.from(seed)` factory; feeding it to Checker_getTypeOfSymbol
// yields the seed TYPE the plugin must decode before constructing the instance.
//
// Signature_parameterCount is len() of this slice; the slice itself is needed
// because detection (count + min-args) is not enough; emission requires the
// seed parameter's type. Returns nil if signature is nil.
func Signature_parameters(signature *innerchecker.Signature) []*innerast.Symbol {
  if signature == nil {
    return nil
  }
  return signature.Parameters()
}

// Signature_hasRestParameter reports whether the signature's last value
// parameter is a rest parameter (`...xs: S[]`). It is the signal a from/new
// transform needs to tell a rest-only single-seed call `(...xs: S[])`, whose
// seed is the ELEMENT S, from a genuine array-typed parameter `(seed: S[])`,
// whose seed is the array S[]: getTypeOfSymbol yields `S[]` for BOTH, so without
// this flag they are indistinguishable and the rest case decodes the wrong
// shape.
//
// The rest ELEMENT is the seed ONLY when the rest parameter is the sole value
// parameter, i.e. `Signature_hasRestParameter(sig) && Signature_parameterCount(sig) == 1`.
// A leading-required + rest-tail signature `(s: S, ...r: R[])` also has a rest
// parameter (this returns true), but its seed is the FIRST parameter S. Read it
// from Signature_parameters(sig)[0], NOT the rest element, matching
// ClassifiableSeed, whose `[infer P, ...Rest]` arm picks P=S there. Returns
// false if signature is nil.
func Signature_hasRestParameter(signature *innerchecker.Signature) bool {
  if signature == nil {
    return false
  }
  return signature.HasRestParameter()
}

// Checker_getRestTypeOfSignature returns the ELEMENT type of the signature's
// rest parameter (`...xs: S[]` -> S; a tuple rest unwraps to its element too),
// which is the seed type for a rest-ONLY single-argument constructor/factory,
// matching ClassifiableSeed, which unwraps the rest to its element. When the
// signature has NO rest parameter it falls back to `any` upstream; and a
// leading-required + rest-tail `(s: S, ...r: R[])` has a rest parameter yet its
// seed is the FIRST parameter S, not the rest element. So take the rest element
// only when `Signature_hasRestParameter(sig) && Signature_parameterCount(sig) == 1`;
// otherwise read Signature_parameters(sig)[0]. Returns nil if recv or signature
// is nil.
func Checker_getRestTypeOfSignature(recv *innerchecker.Checker, signature *innerchecker.Signature) *innerchecker.Type {
  if recv == nil || signature == nil {
    return nil
  }
  return recv.GetRestTypeOfSignature(signature)
}
