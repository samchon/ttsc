// gen_shims:hand-maintained
//
// This shim file mixes generated re-exports with hand-written `go:linkname`
// declarations targeting unexported `*Checker` methods that the @ttsc/lint
// engine relies on. gen_shims detects the marker on the first line and skips
// this file. Remove the marker only if you are intentionally regenerating and
// willing to re-add the hand-maintained content.

package checker

import (
  "sync"

  innerast "github.com/microsoft/typescript-go/internal/ast"
  innerchecker "github.com/microsoft/typescript-go/internal/checker"
  innernodebuilder "github.com/microsoft/typescript-go/internal/nodebuilder"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
  _ "unsafe"
)

// Checker owns the type graph and semantic queries for one compiler program.
// Access shared instances under the mutex returned by NewChecker.
//
// @evidence contracts/common.md#principled-implementation The exact alias preserves compiler-owned type identity and query state; graph objects must stay associated with the checker that produced them.
// @evidence contracts/common.md#clear-and-simple-design One upstream checker is the semantic authority, avoiding an independently maintained type graph at the shim boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias exposes supported compiler objects without replacing query methods or synthesizing fixture semantics.
// @evidence contracts/common.md#meaningful-documentation Native prose states program ownership and caller synchronization instead of implying immutable or thread-safe checker state.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Checker = innerchecker.Checker

// IndexInfo describes a compiler index signature, including its key and value types.
//
// @evidence contracts/common.md#principled-implementation The alias retains the compiler's key/value type identities and readonly/declaration facts for index-signature semantics.
// @evidence contracts/common.md#clear-and-simple-design One existing record carries index-signature facts without a lossy shim projection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No index key or value is fabricated from consumer conventions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the semantic role and key/value distinction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type IndexInfo = innerchecker.IndexInfo

// Signature represents one checked call or construct signature and its parameters.
// Signature objects belong to their producing Checker.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves instantiated parameters, return and type-parameter relationships needed by checker queries.
// @evidence contracts/common.md#clear-and-simple-design The compiler's signature object is shared rather than copied into a second overload model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias preserves semantic signatures rather than inferring them from printed syntax.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes call/construct signatures and states checker ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Signature = innerchecker.Signature

// SignatureFlags is the compiler bitmask for signature properties such as rest parameters.
//
// @evidence contracts/common.md#principled-implementation The upstream bitmask preserves combinable signature distinctions expected by compiler predicates.
// @evidence contracts/common.md#clear-and-simple-design One compiler flag representation serves signature queries without shim-specific translation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Upstream flag meanings remain unchanged rather than hardcoded from selected examples.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies bitmask composition and a meaningful signature distinction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SignatureFlags = innerchecker.SignatureFlags

// SignatureKind selects call signatures or construct signatures in checker queries.
//
// @evidence contracts/common.md#principled-implementation The enum preserves the two upstream signature populations rather than conflating invocation and construction.
// @evidence contracts/common.md#clear-and-simple-design One discriminant selects the intended query population.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The enum expresses language invocation categories without consumer exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose names both selectable signature categories.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SignatureKind = innerchecker.SignatureKind

// Type is a compiler semantic type, including instantiated and composite types.
// It belongs to its producing Checker and is not a serialized AST node.
//
// @evidence contracts/common.md#principled-implementation Exact type identity retains compiler links among unions, intersections, references and instantiations; its discriminants govern which payload is valid.
// @evidence contracts/common.md#clear-and-simple-design The alias keeps semantic representation with the compiler instead of building a parallel shim type system.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No semantic type is reconstructed from consumer names or printed text.
// @evidence contracts/common.md#meaningful-documentation Native prose states semantic versus syntax identity and producing-checker ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Type = innerchecker.Type

// TypeAlias retains a semantic type alias's symbol and instantiated arguments.
// Obtain it from Type.Alias; its read-only accessors accept a nil alias.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity preserves compiler-owned symbol and type-argument provenance exposed by Type.Alias.
// @evidence contracts/common.md#clear-and-simple-design One upstream record exposes existing semantic metadata without duplicating checker state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alias metadata comes from a checked Type rather than reconstructed declaration names.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies metadata, its producer and nil-safe accessor behavior.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeAlias = innerchecker.TypeAlias

// NodeBuilderImpl serializes checked types within an active builder context.
// Obtain it only inside WithNodeBuilderContext and do not retain it afterward.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves the checker, emit factory and active serialization context required by TypeAlias.ToTypeReferenceNode.
// @evidence contracts/common.md#clear-and-simple-design A borrowed compiler implementation serves the existing metadata conversion without another semantic serializer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The implementation comes from the upstream builder with a real entered context; a nil-context constructor is not presented as usable state.
// @evidence contracts/common.md#meaningful-documentation Native prose states the callback producer and forbids retaining the context-bound value beyond its lifetime.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeBuilderImpl = innerchecker.NodeBuilderImpl

// WithNodeBuilderContext converts checked metadata in a fresh builder context.
// Hold the producing checker's mutex, supply this emit round's context, and
// use an enclosing declaration from that same program (or nil). The callback
// must not retain the borrowed implementation or use it concurrently.
//
// The compiler's default serialization flags and tracker apply. Callback
// errors are returned unchanged; compiler serialization errors return a nil
// node. Context restoration runs on success, callback error and panic.
//
// @evidence contracts/common.md#principled-implementation NewNodeBuilder and its real enter/exit operations establish the host, tracker and enclosing-file context before the generated private field accessor supplies the implementation.
// @evidence contracts/common.md#clear-and-simple-design A scoped callback separates compiler-state acquisition from caller conversion while a fresh builder owns each nested invocation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No private layout is handwritten or patched, and no unusable raw getter is published as a producer; official generation derives the one required field access.
// @evidence contracts/common.md#meaningful-documentation Native prose states synchronization, program and emit identity, default flags, borrowing limits, nil result and error/panic restoration.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The deferred pop restores the builder context on every return path, so no context outlives the call.
// @evidenceExclude contracts/performance.md#efficient-algorithms Constant work around one callback invocation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work It creates one node-builder context per call and shares none.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory compiler nodes only; it accesses no path or filesystem.
func WithNodeBuilderContext(ch *Checker, emitContext *innerprinter.EmitContext, enclosing *innerast.Node, use func(*NodeBuilderImpl) (*innerast.Node, error)) (*innerast.Node, error) {
  builder := innerchecker.NewNodeBuilder(ch, emitContext)
  nodeBuilderEnterContext(builder, enclosing, innernodebuilder.FlagsNone, innernodebuilder.InternalFlagsNone, nil)
  exited := false
  defer func() {
    if !exited {
      nodeBuilderPopContext(builder)
    }
  }()
  node, err := use(nodeBuilder_impl(builder))
  if err != nil {
    return nil, err
  }
  node = nodeBuilderExitContext(builder, node)
  exited = true
  return node, nil
}

//go:linkname nodeBuilderEnterContext github.com/microsoft/typescript-go/internal/checker.(*NodeBuilder).enterContext
func nodeBuilderEnterContext(*innerchecker.NodeBuilder, *innerast.Node, innernodebuilder.Flags, innernodebuilder.InternalFlags, innernodebuilder.SymbolTracker)

//go:linkname nodeBuilderExitContext github.com/microsoft/typescript-go/internal/checker.(*NodeBuilder).exitContext
func nodeBuilderExitContext(*innerchecker.NodeBuilder, *innerast.Node) *innerast.Node

//go:linkname nodeBuilderPopContext github.com/microsoft/typescript-go/internal/checker.(*NodeBuilder).popContext
func nodeBuilderPopContext(*innerchecker.NodeBuilder)

// IsTypeUsableAsPropertyName reports whether t is a string or number literal
// or a unique symbol type. t must be a nonnil compiler semantic type.
//
// @evidence contracts/common.md#principled-implementation The upstream semantic flag test preserves literal and unique-symbol property-name eligibility.
// @evidence contracts/common.md#clear-and-simple-design One predicate qualifies inputs to GetPropertyNameFromType without another type classifier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Eligibility follows actual type flags rather than printed type spelling.
// @evidence contracts/common.md#meaningful-documentation Native prose names supported semantic categories and nonnil input.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsTypeUsableAsPropertyName acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsTypeUsableAsPropertyName performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsTypeUsableAsPropertyName computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsTypeUsableAsPropertyName computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsTypeUsableAsPropertyName(t *Type) bool {
  return innerchecker.IsTypeUsableAsPropertyName(t)
}

// GetPropertyNameFromType returns a literal or unique-symbol property's
// compiler name. t must satisfy IsTypeUsableAsPropertyName; other types panic.
//
// @evidence contracts/common.md#principled-implementation Upstream literal-value and unique-symbol decoding preserves semantic property identity and numeric spelling.
// @evidence contracts/common.md#clear-and-simple-design One decoder consumes the adjacent eligibility predicate's qualified semantic input.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Property identity is not guessed from source text or converted from unsupported types.
// @evidence contracts/common.md#meaningful-documentation Native prose states the qualification requirement and unsupported-type panic.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetPropertyNameFromType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetPropertyNameFromType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetPropertyNameFromType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetPropertyNameFromType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetPropertyNameFromType(t *Type) string {
  return innerchecker.GetPropertyNameFromType(t)
}

// GetSetAccessorValueParameter returns the value parameter of a setter,
// accounting for an explicit this parameter. accessor must be a setter node.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream setter-parameter selection and explicit-this handling.
// @evidence contracts/common.md#clear-and-simple-design One syntax query exposes the compiler's existing accessor convention.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Parameter selection follows actual setter syntax rather than a fixed consumer name.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the setter premise and explicit-this distinction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetSetAccessorValueParameter acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetSetAccessorValueParameter performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetSetAccessorValueParameter computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetSetAccessorValueParameter computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetSetAccessorValueParameter(accessor *innerast.Node) *innerast.Node {
  return innerchecker.GetSetAccessorValueParameter(accessor)
}

// TypeMapper is the compiler's type-parameter substitution mapping.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the compiler's simple, array and composite substitution representations and their source/target type identity.
// @evidence contracts/common.md#clear-and-simple-design Substitution uses the compiler's existing mapper model across construction and instantiation wrappers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No ad hoc name-based substitution or foreign instantiator replacement is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies semantic type-parameter substitution rather than a generic object map.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeMapper = innerchecker.TypeMapper

// TypeMapperKind discriminates the compiler's substitution mapper representations.
//
// @evidence contracts/common.md#principled-implementation The exact enum preserves payload discrimination required by upstream mapper dispatch.
// @evidence contracts/common.md#clear-and-simple-design The same kind representation connects mapper constructors and consumers without a shim discriminator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler mapper variants are retained without selecting consumer-specific behavior.
// @evidence contracts/common.md#meaningful-documentation Native prose states why the discriminator exists: choosing a substitution representation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeMapperKind = innerchecker.TypeMapperKind

// TypeFlags is the compiler bitmask describing semantic type categories.
//
// @evidence contracts/common.md#principled-implementation The upstream bitmask preserves semantic category combinations used to interpret type payloads and choose checker operations.
// @evidence contracts/common.md#clear-and-simple-design One native flag vocabulary connects the compiler and its plugin consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flags are not inferred from textual type spelling or rewritten for fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes semantic categories and bitmask representation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeFlags = innerchecker.TypeFlags

// ObjectFlags is the compiler bitmask refining object types, including references and tuples.
//
// @evidence contracts/common.md#principled-implementation The alias preserves object-specific flags distinct from general TypeFlags, matching upstream reference and tuple payload interpretation.
// @evidence contracts/common.md#clear-and-simple-design Object refinement remains in the compiler's established flag layer rather than a new shim taxonomy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The representation retains real object-category flags without guessing from declaration names.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies object refinement and examples relevant to exposed tuple queries.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ObjectFlags = innerchecker.ObjectFlags

// ElementFlags is the compiler bitmask for required, optional, rest and variadic tuple elements.
//
// @evidence contracts/common.md#principled-implementation Preserving tuple element flags retains positional optionality and variadic distinctions needed by compiler tuple semantics.
// @evidence contracts/common.md#clear-and-simple-design Existing compiler flags describe tuple elements without separate shim metadata.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Tuple categories are not reduced to a guessed fixed-length representation.
// @evidence contracts/common.md#meaningful-documentation Native prose explicitly lists required, optional, rest and variadic meanings.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ElementFlags = innerchecker.ElementFlags

// Program is the semantic input interface required to construct an upstream Checker.
//
// @evidence contracts/common.md#principled-implementation The exact interface alias retains the source/options and resolution capabilities the checker expects from its program.
// @evidence contracts/common.md#clear-and-simple-design Checker construction consumes the compiler's existing program boundary without a second adapter contract.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A caller implements the real compiler interface rather than replacing checker internals.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the checker-construction role and interface nature.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Program = innerchecker.Program

// Tracer carries the compiler's optional semantic tracing state for a Checker.
//
// @evidence contracts/common.md#principled-implementation The exact alias preserves tracing state expected by upstream checker construction without interpreting diagnostic events independently.
// @evidence contracts/common.md#clear-and-simple-design Optional tracing remains a compiler-owned concern passed through NewChecker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias introduces no injected expected trace or global tracer replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies optional tracing and its checker context.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Tracer = innerchecker.Tracer

//go:linkname checkerNewAnonymousType github.com/microsoft/typescript-go/internal/checker.(*Checker).newAnonymousType
func checkerNewAnonymousType(
  recv *innerchecker.Checker,
  symbol *innerast.Symbol,
  members innerast.SymbolTable,
  callSignatures []*innerchecker.Signature,
  constructSignatures []*innerchecker.Signature,
  indexInfos []*innerchecker.IndexInfo,
) *innerchecker.Type

//go:linkname checkerGetTargetSymbol github.com/microsoft/typescript-go/internal/checker.(*Checker).getTargetSymbol
func checkerGetTargetSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Symbol

//go:linkname checkerIsPrototypeProperty github.com/microsoft/typescript-go/internal/checker.isPrototypeProperty
func checkerIsPrototypeProperty(symbol *innerast.Symbol) bool

//go:linkname checkerArePropertiesAbstractOrInterface github.com/microsoft/typescript-go/internal/checker.(*Checker).arePropertiesAbstractOrInterface
func checkerArePropertiesAbstractOrInterface(
  recv *innerchecker.Checker,
  base *innerast.Symbol,
  baseDeclarationFlags innerast.ModifierFlags,
) bool

// Checker_isPropertyAssignableTo asks the upstream assignability relater about
// exactly one source/target property pair. The anonymous types retain the
// original property symbols, so propertyRelatedTo still enforces instantiated
// generic types, overloads, optionality, and private/protected declaration
// origins without an unrelated sibling member participating in the result.
// The symbols must have the same name and belong to recv's type graph. A
// shared checker requires caller-owned synchronization.
//
// @evidence contracts/common.md#principled-implementation Single-member anonymous types retain the original symbols so upstream structural assignability applies generic, optional and visibility semantics to exactly that member pair; both symbols must originate in the supplied checker.
// @evidence contracts/common.md#clear-and-simple-design Two minimal anonymous type views isolate one relation without rewriting the upstream property relater or introducing sibling-dependent results.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Anonymous types use the compiler's constructor rather than monkey patching its relater; equal names include valid empty-string property symbols rather than treating an empty spelling as a missing-symbol sentinel.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain retained-symbol semantics, same-name/type-graph premises and caller synchronization rather than promising a syntax-only override check.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_isPropertyAssignableTo acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_isPropertyAssignableTo performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_isPropertyAssignableTo computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_isPropertyAssignableTo computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_isPropertyAssignableTo(
  recv *innerchecker.Checker,
  sourceProperty *innerast.Symbol,
  targetProperty *innerast.Symbol,
) bool {
  if recv == nil || sourceProperty == nil || targetProperty == nil ||
    sourceProperty.Name != targetProperty.Name {
    return false
  }
  source := checkerNewAnonymousType(
    recv,
    nil,
    innerast.SymbolTable{sourceProperty.Name: sourceProperty},
    nil,
    nil,
    nil,
  )
  target := checkerNewAnonymousType(
    recv,
    nil,
    innerast.SymbolTable{targetProperty.Name: targetProperty},
    nil,
    nil,
    nil,
  )
  return source != nil && target != nil && recv.IsTypeAssignableTo(source, target)
}

// Checker_isValidClassMemberOverridePair applies the class-only member-kind
// boundary from checkKindsOfPropertyMemberOverrides to one exact pair. Ordinary
// structural assignability permits more shapes than a class extends clause:
// notably a concrete property/accessor cannot be replaced by a method, while a
// base method may be replaced by a function-valued property.
// The symbols must belong to the supplied checker and represent direct class
// members. This predicate checks member kind, not type assignability.
//
// @evidence contracts/common.md#principled-implementation Resolving target symbols and applying the pinned checkKindsOfPropertyMemberOverrides flags preserves direct-class property/accessor/method constraints; structural assignability is a separate required relation.
// @evidence contracts/common.md#clear-and-simple-design One direct-pair predicate exposes member-kind legality independently from Checker_isPropertyAssignableTo, so callers can require both without importing internal flag policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Assignment and abstract/interface exceptions are upstream class-member semantics; the mapped-property exception is absent because a direct class base member cannot be mapped.
// @evidence contracts/common.md#meaningful-documentation Native prose contrasts class inheritance with structural assignment and states direct-member, same-checker and kind-only limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_isValidClassMemberOverridePair acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_isValidClassMemberOverridePair performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_isValidClassMemberOverridePair computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_isValidClassMemberOverridePair computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_isValidClassMemberOverridePair(
  recv *innerchecker.Checker,
  derivedProperty *innerast.Symbol,
  baseProperty *innerast.Symbol,
) bool {
  if recv == nil || derivedProperty == nil || baseProperty == nil {
    return false
  }
  derived := checkerGetTargetSymbol(recv, derivedProperty)
  base := checkerGetTargetSymbol(recv, baseProperty)
  if derived == nil || base == nil || derived == base {
    return false
  }

  baseDeclarationFlags := innerchecker.GetDeclarationModifierFlagsFromSymbol(base)
  basePropertyFlags := base.Flags & innerast.SymbolFlagsPropertyOrAccessor
  derivedPropertyFlags := derived.Flags & innerast.SymbolFlagsPropertyOrAccessor
  if basePropertyFlags != 0 && derivedPropertyFlags != 0 {
    // A direct class base member cannot be a mapped property. The upstream
    // mapped-property exception therefore has no member declaration this
    // direct-pair API could publish; assignment declarations and abstract /
    // interface members are the two applicable exceptions.
    if derived.ValueDeclaration != nil && innerast.IsBinaryExpression(derived.ValueDeclaration) ||
      checkerArePropertiesAbstractOrInterface(recv, base, baseDeclarationFlags) {
      return true
    }
    overriddenInstanceProperty := basePropertyFlags != innerast.SymbolFlagsProperty &&
      derivedPropertyFlags == innerast.SymbolFlagsProperty
    overriddenInstanceAccessor := basePropertyFlags == innerast.SymbolFlagsProperty &&
      derivedPropertyFlags != innerast.SymbolFlagsProperty
    return !overriddenInstanceProperty && !overriddenInstanceAccessor
  }
  if checkerIsPrototypeProperty(base) {
    return checkerIsPrototypeProperty(derived) ||
      derived.Flags&innerast.SymbolFlagsProperty != 0
  }
  return false
}

// NewChecker creates a checker that owns its complete type graph for program.
// The returned mutex is the upstream checker-pool synchronization primitive;
// callers that share the checker must serialize access through it.
//
// @evidence contracts/common.md#principled-implementation Delegating construction keeps the checker, its program-dependent type graph and returned synchronization primitive paired under the upstream program interface.
// @evidence contracts/common.md#clear-and-simple-design One constructor returns the semantic object and its lock together without a duplicate graph or locking layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Construction uses the actual supplied program and optional tracer rather than a foreign checker replacement or synthetic semantic result.
// @evidence contracts/common.md#meaningful-documentation Native prose states type-graph ownership and caller serialization through the paired mutex.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The checker and its mutex are returned to the caller, who owns their lifetime.
// @evidenceExclude contracts/performance.md#efficient-algorithms Delegates directly to the upstream constructor, which owns its cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds one checker; any sharing is the caller's decision.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Delegates to the upstream checker constructor; the shim handles no path or file.
func NewChecker(program Program, tracer *Tracer) (*Checker, *sync.Mutex) {
  return innerchecker.NewChecker(program, tracer)
}

//go:linkname checkerGetRegularTypeOfLiteralType github.com/microsoft/typescript-go/internal/checker.(*Checker).getRegularTypeOfLiteralType
func checkerGetRegularTypeOfLiteralType(recv *innerchecker.Checker, t *innerchecker.Type) *innerchecker.Type

// Checker_getRegularTypeOfLiteralType returns the canonical regular form of a
// literal type. TypeScript's checker uses this before comparing switch case
// types because a source literal's fresh type and a union member's regular type
// denote the same runtime value but have different pointers.
// Nil checker or type leaves the supplied type unchanged.
//
// @evidence contracts/common.md#principled-implementation The pinned regular-literal helper canonicalizes fresh literal identity while preserving its semantic value, making pointer-based comparison use the same representation as union members.
// @evidence contracts/common.md#clear-and-simple-design One guarded bridge exposes compiler canonicalization without duplicating literal interning or conversion rules.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The nil fallback preserves the input rather than constructing a desired literal; actual canonicalization remains with the producing compiler checker.
// @evidence contracts/common.md#meaningful-documentation Native prose explains fresh-versus-regular pointer identity, runtime meaning and nil input preservation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getRegularTypeOfLiteralType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getRegularTypeOfLiteralType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getRegularTypeOfLiteralType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getRegularTypeOfLiteralType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getRegularTypeOfLiteralType(recv *innerchecker.Checker, t *innerchecker.Type) *innerchecker.Type {
  if recv == nil || t == nil {
    return t
  }
  return checkerGetRegularTypeOfLiteralType(recv, t)
}

// ValueToString renders a literal type's value in TypeScript source form: a
// string as a double-quoted, escaped literal, a number, boolean, or bigint as
// the way it is written. It is the checker's own renderer, so a consumer
// enumerating a literal union reports the values the way the compiler prints
// them, including numeric formatting and string escaping it should not re-derive.
//
// It panics on a value it does not handle, notably the nil a computed enum
// member carries, so a caller holding a `LiteralType.Value()` must reject nil
// before calling this.
//
// @evidence contracts/common.md#principled-implementation Delegating supported literal values to the checker's renderer preserves TypeScript escaping and numeric spelling; unsupported runtime values remain outside its domain and panic.
// @evidence contracts/common.md#clear-and-simple-design One renderer bridge centralizes compiler literal syntax without a separate shim serializer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Values are formatted from actual compiler data, with no expected string table or special-case enum member names.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state source-form output and the unsupported/nil-value panic boundary with explanatory context.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ValueToString acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms ValueToString performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ValueToString computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ValueToString computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func ValueToString(value any) string {
  return innerchecker.ValueToString(value)
}

// Checker_typeToStringFullyQualified formats a type with the same stable,
// alias-aware flags TypeScript uses in diagnostics that name union members.
// Keeping the flag bundle inside the shim avoids leaking checker-internal enum
// types through consumer code.
// Nil checker or type returns empty text. A nonnil type must belong to recv.
//
// @evidence contracts/common.md#principled-implementation AllowUniqueESSymbolType, UseAliasDefinedOutsideCurrentScope and UseFullyQualifiedType preserve unique-symbol and externally defined alias naming at the supplied declaration scope; this is a presentation query over the producing checker.
// @evidence contracts/common.md#clear-and-simple-design One named formatting policy owns its flags, leaving graph consumers independent of internal formatting enums.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flags are compiler-defined formatting controls rather than patches to type identity or consumer-specific output strings.
// @evidence contracts/common.md#meaningful-documentation Native prose explains alias-aware scope, flag ownership, nil output and same-checker requirements.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_typeToStringFullyQualified acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_typeToStringFullyQualified performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_typeToStringFullyQualified computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_typeToStringFullyQualified computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
// Nil checker or symbol returns empty text. Symbols must belong to recv.
//
// @evidence contracts/common.md#principled-implementation Value meaning and AllowAnyNodeKind delegate expression spelling to the checker's symbol formatter, allowing indexed access where an identifier-like name is unavailable.
// @evidence contracts/common.md#clear-and-simple-design One wrapper owns value-position formatting policy without manual namespace concatenation or an AST printer fallback.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Indexed member spelling comes from the compiler's real symbol representation rather than a consumer-name escape table.
// @evidence contracts/common.md#meaningful-documentation Native prose explains expression-position output, indexed access and nil/same-checker limits before the tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_symbolToValueString acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_symbolToValueString performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_symbolToValueString computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_symbolToValueString computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
// Nil checker, symbol or enclosing declaration returns false.
//
// @evidence contracts/common.md#principled-implementation Upstream IsSymbolAccessible applies value-meaning accessibility in the supplied scope, including containing symbols, so the result answers semantic visibility rather than merely whether a name can be printed.
// @evidence contracts/common.md#clear-and-simple-design One boolean query separates accessibility from value-string formatting, keeping visibility policy in the compiler.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper does not assume a qualified name is accessible because its text is known; actual checker accessibility must succeed.
// @evidence contracts/common.md#meaningful-documentation Native prose explains containing-symbol visibility and nil refusal, distinguishing this operation from an accessible-chain lookup.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_isSymbolAccessibleAsValue acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_isSymbolAccessibleAsValue performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_isSymbolAccessibleAsValue computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_isSymbolAccessibleAsValue computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
  SignatureFlagsAbstract = innerchecker.SignatureFlagsAbstract

  SignatureKindCall = innerchecker.SignatureKindCall

  TypeMapperKindUnknown = innerchecker.TypeMapperKindUnknown
  TypeMapperKindSimple  = innerchecker.TypeMapperKindSimple
  TypeMapperKindArray   = innerchecker.TypeMapperKindArray
  TypeMapperKindMerged  = innerchecker.TypeMapperKindMerged

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

// IsTupleType reports whether t is a tuple reference, including rest and
// variadic tuples. t must be nonnil.
//
// @evidence contracts/common.md#principled-implementation The upstream predicate checks reference and target tuple object flags, covering variadic tuples as well as fixed-length ones under the nonnil type premise.
// @evidence contracts/common.md#clear-and-simple-design One predicate delegates representation classification without inferring tuples from printed syntax or element count.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixed-size shortcut substitutes for the compiler's tuple identity.
// @evidence contracts/common.md#meaningful-documentation Native prose states rest/variadic inclusion and the nonnil type requirement.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsTupleType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsTupleType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsTupleType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsTupleType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsTupleType(t *innerchecker.Type) bool {
  return innerchecker.IsTupleType(t)
}

// Checker_getIndexInfosOfType returns semantic index information after reduced
// apparent-type normalization. Results can include inherited or instantiated
// index signatures and combined union/intersection information, rather than
// only signatures directly declared on t.
// recv and t must be nonnil and belong to the same checker graph.
//
// @evidence contracts/common.md#principled-implementation Upstream index-info lookup resolves semantic index signatures of the supplied checker type, preserving key/value identities instead of parsing declaration spelling.
// @evidence contracts/common.md#clear-and-simple-design One direct semantic query exposes existing index information without a separate index-signature walker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Index signatures come from the actual type graph rather than guessed numeric or string property names.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes normalized semantic index information from direct declarations and specifies same-checker nonnil premises.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned index-info slice is structured-type state owned by the checker, and its entries reference semantic key/value types. Upstream resolution owns any synthesized members; the caller controls additional retention through the borrowed result, while the wrapper stores no separate cache or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper selects no resolution strategy. Upstream reduction, apparent-type normalization and structured-member resolution can instantiate signatures, traverse base types or combine union/intersection constituents and index lists; cost follows those graphs and lists rather than fixed wrapper steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ObjectFlagsMembersResolved and structured-type member state coordinate reuse in the producing checker. This forwarding wrapper owns no additional index-query cache or repeated-work policy.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Type normalization and member resolution remain with the supplied checker/program; this wrapper adds no path, host or platform policy.
func Checker_getIndexInfosOfType(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.IndexInfo {
  return recv.GetIndexInfosOfType(t)
}

// Checker_getPropertiesOfType returns the named property symbols of t. For
// unions, properties must be available across constituents; intersections
// combine constituent properties under checker semantics. recv and t must be
// nonnil and belong to the same checker graph.
//
// @evidence contracts/common.md#principled-implementation Upstream property lookup applies union common-property and intersection combined-property semantics, retaining compiler-generated symbol identities and instantiated property types.
// @evidence contracts/common.md#clear-and-simple-design One checker query owns composite-type property formation instead of an independent shim intersection or union merger.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Composite properties are not reduced to a common-member approximation for every type category.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes union from intersection behavior and states graph/nonnil premises.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getPropertiesOfType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getPropertiesOfType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getPropertiesOfType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getPropertiesOfType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getPropertiesOfType(recv *innerchecker.Checker, t *innerchecker.Type) []*innerast.Symbol {
  return recv.GetPropertiesOfType(t)
}

// Checker_getApparentProperties returns the properties visible on t after
// resolving primitive wrapper types (e.g. string to String).
// Callable or constructable types also receive applicable global function
// properties when the type does not already declare those names.
// recv and t must be nonnil and belong to the same checker graph.
//
// @evidence contracts/common.md#principled-implementation Delegating apparent-property lookup preserves the compiler's apparent-type normalization before collecting visible semantic properties.
// @evidence contracts/common.md#clear-and-simple-design Apparent lookup remains distinct from direct properties so callers select the actual semantic question without a duplicated normalization layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Primitive properties come from compiler apparent types, not a hardcoded wrapper-member inventory.
// @evidence contracts/common.md#meaningful-documentation Native prose gives the primitive-wrapper example and nonnil same-graph conditions.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream augmentation creates a temporary name table and returns a symbol slice proportional to collected properties. The caller owns the returned slice lifetime and references into checker-owned semantic state; the wrapper stores no independent result or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper selects no collection strategy. Upstream apparent-type/property/signature resolution, name hashing and function-member augmentation precede named-member filtering and sorting; their property counts and comparison costs belong to that checker implementation rather than fixed local steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Semantic type/property reuse belongs to the supplied checker; the upstream augmentation builds its own per-query table and slice. The forwarding wrapper owns no additional cache or coordination of repeated queries.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Apparent-type and global-member interpretation use the supplied checker graph; this wrapper introduces no path, host or platform policy.
func Checker_getApparentProperties(recv *innerchecker.Checker, t *innerchecker.Type) []*innerast.Symbol {
  return recv.GetApparentProperties(t)
}

// Checker_getTypeArguments returns resolved type arguments of a generic
// reference type. t must be a nonnil type reference in recv's checker graph;
// other type representations do not satisfy the upstream accessor's domain.
//
// @evidence contracts/common.md#principled-implementation The upstream reference query supplies resolved type arguments associated with the actual compiler reference rather than syntactic arguments that may omit inferred instantiation.
// @evidence contracts/common.md#clear-and-simple-design One direct reference query exposes instantiated arguments without another generic type model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Type argument identity is retained instead of guessed from type names or printed angle brackets.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies resolved generic-reference scope and the nonnil type-reference/producing-checker domain instead of promising non-reference nil.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getTypeArguments acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getTypeArguments performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getTypeArguments computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getTypeArguments computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getTypeArguments(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.Type {
  return recv.GetTypeArguments(t)
}

// Checker_getTypeOfSymbol returns symbol's value type, resolving aliases and
// following late-bound types. For a class this is its constructor/static type;
// use Checker_getDeclaredTypeOfSymbol for the instance type.
// recv and symbol must be nonnil; the symbol must belong to recv.
//
// @evidence contracts/common.md#principled-implementation Upstream symbol typing follows its alias and late-binding semantics using the producing checker, preserving compiler type identity rather than declaration-only inference.
// @evidence contracts/common.md#clear-and-simple-design One symbol-to-type query leaves binding and resolution with the existing checker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No type is synthesized from consumer naming or a cached textual annotation.
// @evidence contracts/common.md#meaningful-documentation Native prose names alias/late-bound handling, class value versus instance typing and nonnil checker ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getTypeOfSymbol acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getTypeOfSymbol performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getTypeOfSymbol computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getTypeOfSymbol computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getTypeOfSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerchecker.Type {
  return recv.GetTypeOfSymbol(symbol)
}

// Checker_getTypeOfSymbolAtLocation returns the contextual type of symbol as
// observed at the given AST node (useful for narrowed types in control flow).
// Checker and symbol must be nonnil and belong to the same checked program.
// A nil node requests the ordinary symbol type without location narrowing.
//
// @evidence contracts/common.md#principled-implementation The location-aware upstream query applies the supplied symbol's meaning at an actual checked AST node when present; nil location or a node without a matching reference falls back to ordinary symbol typing rather than inventing control-flow narrowing.
// @evidence contracts/common.md#clear-and-simple-design This wrapper makes location dependence explicit instead of mixing contextual and declared type queries.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Context comes from a real checked node, not a fixture offset or textual narrowing heuristic.
// @evidence contracts/common.md#meaningful-documentation Native prose explains contextual typing, same-program checker/symbol requirements and nil location's unnarrowed result.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getTypeOfSymbolAtLocation acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getTypeOfSymbolAtLocation performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getTypeOfSymbolAtLocation computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getTypeOfSymbolAtLocation computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getTypeOfSymbolAtLocation(recv *innerchecker.Checker, symbol *innerast.Symbol, node *innerast.Node) *innerchecker.Type {
  return recv.GetTypeOfSymbolAtLocation(symbol, node)
}

// Checker_getTypeOfPropertyOfType looks up the type of the named property on t
// and returns nil when no such property exists.
// recv and t must be nonnil and belong to the same checker graph.
//
// @evidence contracts/common.md#principled-implementation Semantic property lookup uses the compiler's instantiated type and member name, returning the property's checked type only when that member exists.
// @evidence contracts/common.md#clear-and-simple-design One type/name lookup delegates property resolution without separately resolving symbols and reimplementing property typing.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing members remain absent rather than receiving a fabricated fallback type.
// @evidence contracts/common.md#meaningful-documentation Native prose states missing-property nil and same-checker nonnil requirements.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getTypeOfPropertyOfType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getTypeOfPropertyOfType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getTypeOfPropertyOfType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getTypeOfPropertyOfType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getTypeOfPropertyOfType(recv *innerchecker.Checker, t *innerchecker.Type, name string) *innerchecker.Type {
  return recv.GetTypeOfPropertyOfType(t, name)
}

//go:linkname checkerGetPropertyNameForKnownSymbolName github.com/microsoft/typescript-go/internal/checker.(*Checker).getPropertyNameForKnownSymbolName
func checkerGetPropertyNameForKnownSymbolName(recv *innerchecker.Checker, symbolName string) string

// Checker_getPropertyNameForKnownSymbolName returns the late-bound property
// name the checker uses for a member keyed by the global well-known symbol
// `Symbol.<symbolName>` (e.g. "asyncIterator", "asyncDispose", "iterator").
// It resolves the unique-symbol type of that property on the global
// `SymbolConstructor`, including lib-provided and `declare global` augmented
// members, so `(*Checker).GetPropertyOfType(t, name)` with the returned name
// finds exactly the members declared as `[Symbol.<symbolName>]`. This is the
// same resolution the checker itself performs when it validates `for await`
// iterability, which is why a lint rule that mirrors typescript-eslint's
// well-known-symbol protocol checks must go through it instead of matching
// property-name text. When the global `Symbol` constructor lacks the member,
// the checker's internal fallback name (a `\xFE@`-prefixed string no
// source-declared property can late-bind to) is returned, so lookups simply
// find nothing. Returns "" if recv is nil.
//
// @evidence contracts/common.md#principled-implementation The compiler resolves the global SymbolConstructor member's unique-symbol identity, so computed members match by semantic key even when libraries or global augmentation supply it.
// @evidence contracts/common.md#clear-and-simple-design One bridge owns well-known-symbol key resolution rather than duplicating a textual Symbol-name matcher in lint consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing global members use upstream's unbindable fallback key rather than treating any similarly spelled property as the protocol.
// @evidence contracts/common.md#meaningful-documentation Native prose explains unique-symbol lookup, augmented globals, fallback absence and nil receiver behavior in useful context.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getPropertyNameForKnownSymbolName acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getPropertyNameForKnownSymbolName performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getPropertyNameForKnownSymbolName computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getPropertyNameForKnownSymbolName computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
//
// @evidence contracts/common.md#principled-implementation The pinned iteration helper's Element use and Yield kind obtain synchronous iterator values through actual inherited/instantiated protocol types; a nil diagnostic node makes this an observational query rather than another error-reporting pass.
// @evidence contracts/common.md#clear-and-simple-design One guarded bridge exposes the compiler's iterator semantics without assembling Symbol.iterator and next signatures independently.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Iterator values are not guessed from property spelling or selected container names; upstream semantics cover structural iterables and strings.
// @evidence contracts/common.md#meaningful-documentation Native prose states supported traversal categories, nil-result meaning and disabled diagnostics, separated from tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getSynchronousIterationYieldType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getSynchronousIterationYieldType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getSynchronousIterationYieldType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getSynchronousIterationYieldType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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

// Checker_getAliasSymbolForTypeNode returns the symbol of a type alias
// declaration enclosing node through parenthesized or readonly type wrappers.
// It returns nil when that enclosing declaration is not a type alias; this
// does not resolve the target of a referenced alias. Inputs must be nonnil.
//
// @evidence contracts/common.md#principled-implementation The pinned helper walks node parents through parenthesized and readonly type operators, then obtains the enclosing type-alias declaration's symbol rather than resolving a type-reference target.
// @evidence contracts/common.md#clear-and-simple-design One specifically documented enclosure query exposes compiler alias provenance without conflating it with alias-target resolution.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No alias is inferred from printed type text or a named consumer; the actual AST parent chain defines the result.
// @evidence contracts/common.md#meaningful-documentation Native prose states wrapper traversal, non-alias nil, nonnil inputs and the enclosing-declaration distinction.
// @evidence contracts/performance.md#bound-retention-and-release-resources A returned symbol remains checker-owned and can reference its declarations and semantic graph; the caller controls retention of that reference, while this forwarding wrapper stores no independent result, buffer or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper selects no traversal strategy: the pinned helper walks H enclosing parenthesized/readonly wrappers, then delegates declaration-symbol normalization to the checker. That upstream traversal and symbol state own the cost, not a fixed-step local algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Declaration symbols and merged-symbol reuse belong to the upstream checker; this forwarding wrapper owns no query cache or coordination of repeated enclosure walks.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getAliasSymbolForTypeNode computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getAliasSymbolForTypeNode(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol {
  return checkerGetAliasSymbolForTypeNode(recv, node)
}

//go:linkname checkerGetDeclarationOfAliasSymbol github.com/microsoft/typescript-go/internal/checker.(*Checker).getDeclarationOfAliasSymbol
func checkerGetDeclarationOfAliasSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Node

// Checker_getDeclarationOfAliasSymbol returns the last alias declaration in
// symbol's declarations, or nil when none exists. It does not follow the alias
// to its target declaration. Inputs must be nonnil.
//
// @evidence contracts/common.md#principled-implementation Upstream FindLast with IsAliasSymbolDeclaration selects the alias's own declaration under compiler declaration ordering rather than dereferencing its final target.
// @evidence contracts/common.md#clear-and-simple-design Declaration provenance is queried separately from Checker_getAliasedSymbol target resolution, retaining the difference in the public API's native explanation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The declaration is selected from the actual symbol's compiler declarations without a guessed import/export source.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes alias declaration from target, specifies last-match ordering and absent/nonnil conditions.
// @evidence contracts/performance.md#bound-retention-and-release-resources The result is an existing declaration node that can reach its compiler tree through parents and metadata; the caller controls retention of that reference. The forwarding wrapper creates no collection and stores no independent result or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper chooses no search strategy. Upstream FindLast scans up to D symbol declarations in reverse order, with IsAliasSymbolDeclaration's syntax-dependent predicate work, and stops at the first match.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The producing compiler owns the symbol's declaration sequence and alias classification; this forwarding wrapper owns no declaration-query cache or coordination of repeated searches.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getDeclarationOfAliasSymbol computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getDeclarationOfAliasSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Node {
  return checkerGetDeclarationOfAliasSymbol(recv, symbol)
}

//go:linkname checkerGetTargetOfImportSpecifier github.com/microsoft/typescript-go/internal/checker.(*Checker).getTargetOfImportSpecifier
func checkerGetTargetOfImportSpecifier(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol

// Checker_getTargetOfImportSpecifier resolves an import specifier node to the
// exported symbol it binds. Returns nil if recv or node is nil.
// A nonnil node must be an import specifier in recv's checked program.
//
// @evidence contracts/common.md#principled-implementation The linked helper uses the import specifier's actual binding context to resolve its exported target, retaining checker alias semantics rather than matching module text.
// @evidence contracts/common.md#clear-and-simple-design One guarded import-specific query exposes the existing semantic operation without duplicating module export lookup.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing inputs remain nil and targets are not guessed from specifier names.
// @evidence contracts/common.md#meaningful-documentation Native prose states target meaning, nil behavior and the import-specifier/same-program premise.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getTargetOfImportSpecifier acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getTargetOfImportSpecifier performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getTargetOfImportSpecifier computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getTargetOfImportSpecifier computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getTargetOfImportSpecifier(recv *innerchecker.Checker, node *innerast.Node) *innerast.Symbol {
  if recv == nil || node == nil {
    return nil
  }
  return checkerGetTargetOfImportSpecifier(recv, node)
}

// Checker_getAliasedSymbol follows an alias chain to its final target symbol.
// Returns nil if recv or symbol is nil.
// A nonnil symbol must carry the compiler's Alias flag and belong to recv.
// Unresolved or circular aliases can return the checker's unknown symbol;
// the operation can populate checker alias links and diagnostics.
//
// @evidence contracts/common.md#principled-implementation The compiler follows an actual alias symbol's chain to its semantic target under the Alias-flag and producing-checker premises.
// @evidence contracts/common.md#clear-and-simple-design Target resolution remains separate from declaration lookup and import-node-specific resolution.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The target is not reconstructed by reopening textual module paths or accepting a similarly named symbol.
// @evidence contracts/common.md#meaningful-documentation Native prose states final-target meaning, nil handling and the alias-symbol domain.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream alias links and diagnostics belong to recv's checker lifetime; the returned target or unknown symbol can retain semantic state through the caller's reference. The wrapper stores no separate result or resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper only guards nil inputs and forwards. The upstream checker owns declaration searches, recursive alias resolution, cycle handling and module-target queries; uncached work depends on that semantic graph rather than a fixed number of wrapper steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The upstream aliasSymbolLinks cache stores resolved targets, including the unknown-symbol result. This wrapper owns no separate alias cache or coordination policy.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Alias and module-target interpretation remain with the supplied checker and program; the wrapper adds no path, host or platform policy and does not bypass that authority.
func Checker_getAliasedSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerast.Symbol {
  if recv == nil || symbol == nil {
    return nil
  }
  return recv.GetAliasedSymbol(symbol)
}

// Checker_getExportsOfModule returns the exported symbols of a source-file or
// namespace module symbol, resolving export-star aggregation the same way the
// checker does for emit and services.
// Nil checker or symbol returns nil; a nonnil symbol must be a module in recv.
// The returned slice excludes reserved internal names. Aggregation can cache
// resolved exports and report export-star name collisions in the checker.
//
// @evidence contracts/common.md#principled-implementation Upstream module exports include export-star aggregation and compiler alias identities for the supplied semantic module, rather than only syntactically listed export declarations.
// @evidence contracts/common.md#clear-and-simple-design One module query centralizes aggregation in the checker instead of a separate shim re-export walker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Export targets follow actual compiler bindings without hardcoded barrel paths or consumer exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose names source-file/namespace modules, export-star handling and nil/same-checker constraints.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream aggregation owns temporary visited-symbol/name/collision tables and checker-lifetime resolved-export state. The caller owns the returned symbol slice lifetime and can retain the checker graph through its elements; the wrapper stores no independent result or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper only guards nil inputs and forwards. Uncached upstream work recursively visits export-star modules, checks visited symbols, clones/merges name tables and reports collisions; each result conversion also scans exports to filter reserved names. Graph size and name/predicate costs belong to that implementation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The producing checker caches resolvedExports and type-only export-star metadata, while symbolsToArray creates the per-query result slice. This wrapper owns no additional export cache or repeated-query coordination.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Export and external-module target resolution use the supplied checker/program authority; this wrapper adds no path, host or platform policy.
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
// Name and optional location must belong to recv's checked program.
//
// @evidence contracts/common.md#principled-implementation The pinned entity-name resolver applies meaning flags, scope, alias-resolution and diagnostic controls to the actual AST name, preserving type/value/namespace distinctions.
// @evidence contracts/common.md#clear-and-simple-design One bridge exposes the resolver's relevant controls explicitly rather than duplicating separate dotted-name lookup implementations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The semantic name is resolved by compiler scope rules, not string concatenation or a consumer-specific namespace table.
// @evidence contracts/common.md#meaningful-documentation Native prose explains meaning filtering, diagnostic suppression, alias retention and input ownership in separated sentences.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_resolveEntityName acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_resolveEntityName performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_resolveEntityName computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_resolveEntityName computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
//
// @evidence contracts/common.md#principled-implementation The compiler's name-symbol helper preserves semantic type naming rules, while nil input remains absent without dereferencing a type payload.
// @evidence contracts/common.md#clear-and-simple-design One query exposes name provenance independently of type formatting or general symbol resolution.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No name symbol is guessed from printed text or declaration identifiers.
// @evidence contracts/common.md#meaningful-documentation Native prose states optional name/nil results and why explicit internal linkage is used.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Type_getTypeNameSymbol acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Type_getTypeNameSymbol performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Type_getTypeNameSymbol computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Type_getTypeNameSymbol computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Type_getTypeNameSymbol(t *innerchecker.Type) *innerast.Symbol {
  if t == nil {
    return nil
  }
  return checkerGetTypeNameSymbol(t)
}

//go:linkname checkerIsArrayType github.com/microsoft/typescript-go/internal/checker.(*Checker).isArrayType
func checkerIsArrayType(recv *innerchecker.Checker, t *innerchecker.Type) bool

// Checker_isArrayType reports whether t is a built-in Array<T> or
// ReadonlyArray<T> reference type.
// recv and t must be nonnil and belong to the same checker graph.
//
// @evidence contracts/common.md#principled-implementation The linked predicate uses the producing checker's global Array and ReadonlyArray target identities, distinguishing both built-in references from unrelated array-like objects.
// @evidence contracts/common.md#clear-and-simple-design One compiler identity predicate avoids a separate structural-array classifier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Built-in arrays are not identified by a consumer's type name or numeric-property heuristic.
// @evidence contracts/common.md#meaningful-documentation Native prose states built-in reference scope and nonnil same-checker inputs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_isArrayType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_isArrayType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_isArrayType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_isArrayType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_isArrayType(recv *innerchecker.Checker, t *innerchecker.Type) bool {
  return checkerIsArrayType(recv, t)
}

//go:linkname checkerGetBaseTypes github.com/microsoft/typescript-go/internal/checker.(*Checker).getBaseTypes
func checkerGetBaseTypes(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.Type

// Checker_getBaseTypes returns the list of base types (from `extends` clauses)
// for a class or interface type. Returns nil if recv or t is nil.
// A nonnil t must be a declared class/interface type, not its generic reference.
// The result shares the checker's resolved-base slice; resolving it can update
// type-resolution state and report invalid or circular heritage diagnostics.
//
// @evidence contracts/common.md#principled-implementation The upstream base-type helper resolves a declared class/interface's heritage in its producing checker; generic references must first use their declared class/interface representation.
// @evidence contracts/common.md#clear-and-simple-design One inheritance query leaves heritage resolution with the compiler and states its narrower input domain explicitly.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No base is inferred from a textual extends clause or guessed class name.
// @evidence contracts/common.md#meaningful-documentation Native prose describes heritage output, nil absence and the declared-type versus generic-reference distinction.
// @evidence contracts/performance.md#bound-retention-and-release-resources Resolved-base slices, resolution flags and diagnostics remain checker-owned; the returned slice references that type graph and the caller controls its additional retention. The wrapper stores no separate result or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper only guards nil inputs and forwards. Upstream class/interface heritage resolution owns declaration and extends-element walks, type/signature processing and recursive base checks; uncached cost follows that graph rather than fixed wrapper steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The upstream baseTypesResolved flag and resolvedBaseTypes slice own reuse within the producing checker. The forwarding wrapper introduces no additional cache or coordination policy.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Heritage interpretation remains with the supplied checker/program; this wrapper adds no path, host or platform policy.
func Checker_getBaseTypes(recv *innerchecker.Checker, t *innerchecker.Type) []*innerchecker.Type {
  if recv == nil || t == nil {
    return nil
  }
  return checkerGetBaseTypes(recv, t)
}

//go:linkname checkerGetDeclaredTypeOfSymbol github.com/microsoft/typescript-go/internal/checker.(*Checker).getDeclaredTypeOfSymbol
func checkerGetDeclaredTypeOfSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerchecker.Type

// Checker_getDeclaredTypeOfSymbol returns the compiler's declared type for a
// symbol from recv's checker graph. For a class/interface symbol this is its
// declared instance representation, suitable for Checker_getBaseTypes, rather
// than a class value's constructor type or an instantiated reference.
// Other symbol categories follow upstream declared-type dispatch and do not
// promise a class/interface result; absence of a declared type yields the
// checker's error type. Returns nil if recv or symbol is nil.
//
// @evidence contracts/common.md#principled-implementation For class/interface symbols, compiler declared-type lookup distinguishes the instance-side representation from a class value's constructor type and supports base-type traversal. Other symbol categories retain upstream dispatch and error-type fallback.
// @evidence contracts/common.md#clear-and-simple-design The wrapper exposes instance declaration typing separately from ordinary symbol value typing instead of making consumers coerce type representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Generic heritage traversal uses actual declared compiler types rather than a compensating name-based base lookup.
// @evidence contracts/common.md#meaningful-documentation Native prose scopes the class/interface result, states upstream dispatch/error-type behavior for other symbols, and specifies same-checker and nil conditions.
// @evidence contracts/performance.md#bound-retention-and-release-resources Declared-type links and any class/interface type, this-type or instantiation table remain checker-owned; the caller can retain that graph through the returned type. This forwarding wrapper keeps no separate cache, result or handle.
// @evidenceExclude contracts/performance.md#efficient-algorithms The wrapper guards nil inputs and delegates symbol-category dispatch. Upstream uncached class/interface construction includes outer/local parameter collection and recursive interface heritage checks, while other categories own their semantic resolution costs; this is not a fixed-step local strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The supplied checker owns declaredTypeLinks and type instantiation reuse. The forwarding wrapper does not coordinate or cache repeated declared-type queries.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Symbol typing and related resolution use the supplied checker/program; the wrapper introduces no path, host or platform policy.
func Checker_getDeclaredTypeOfSymbol(recv *innerchecker.Checker, symbol *innerast.Symbol) *innerchecker.Type {
  if recv == nil || symbol == nil {
    return nil
  }
  return checkerGetDeclaredTypeOfSymbol(recv, symbol)
}

//go:linkname checkerGetMinArgumentCount github.com/microsoft/typescript-go/internal/checker.(*Checker).getMinArgumentCount
func checkerGetMinArgumentCount(recv *innerchecker.Checker, signature *innerchecker.Signature) int

// Checker_getMinArgumentCount returns the minimum number of required arguments
// a call/construct signature accepts under compiler rules, including required
// tuple-rest positions and trailing void-accepting parameters. A type-transform
// plugin uses this to gate the single-
// required-parameter constructor strategy (`new C(x)`) and single-arg static
// factory (`C.from(x)`). Returns 0 if recv or signature is nil.
//
// @evidence contracts/common.md#principled-implementation Upstream minimum-arity calculation accounts for required tuple-rest positions, optionality, untyped JavaScript and trailing void acceptance instead of counting declarations before a rest marker.
// @evidence contracts/common.md#clear-and-simple-design One arity query exposes the compiler's complete rule without a second parameter-counting policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The result comes from actual signature semantics rather than a consumer's constructor strategy or fixed expected arity.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes compiler minimum arity from declared parameter count, includes tuple/void cases and documents nil zero.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getMinArgumentCount acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getMinArgumentCount performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getMinArgumentCount computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getMinArgumentCount computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
//
// @evidence contracts/common.md#principled-implementation The upstream type query selects call or construct signatures by kind, retaining instantiated overload identities for further checker queries.
// @evidence contracts/common.md#clear-and-simple-design One explicit kind parameter separates invocation from construction without duplicating type traversal.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Signatures are actual compiler results rather than assumed constructor or factory shapes.
// @evidence contracts/common.md#meaningful-documentation Native prose states selectable populations, relationships to arity/return queries and nil absence.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getSignaturesOfType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getSignaturesOfType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getSignaturesOfType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getSignaturesOfType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getSignaturesOfType(recv *innerchecker.Checker, t *innerchecker.Type, kind innerchecker.SignatureKind) []*innerchecker.Signature {
  if recv == nil || t == nil {
    return nil
  }
  return recv.GetSignaturesOfType(t, kind)
}

// Checker_getReturnTypeOfSignature returns the return type of signature, used to
// verify that a static `from(x)` factory actually returns the class instance
// type before selecting the `C.from(x)` construction strategy. Returns nil if
// recv or signature is nil.
//
// @evidence contracts/common.md#principled-implementation Upstream signature return typing applies its instantiated semantic context rather than using a syntactic return annotation that may be inferred or generic.
// @evidence contracts/common.md#clear-and-simple-design One return query complements signature enumeration while keeping semantic resolution inside the checker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A factory's return is queried instead of assumed from its name or construction convention.
// @evidence contracts/common.md#meaningful-documentation Native prose explains return-type purpose and nil inputs separately from implementation acknowledgments.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getReturnTypeOfSignature acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getReturnTypeOfSignature performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getReturnTypeOfSignature computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getReturnTypeOfSignature computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
//
// @evidence contracts/common.md#principled-implementation The compiler stores value parameters separately from this, so their slice length counts declared parameters, including a rest declaration once, independently of minimum call arity.
// @evidence contracts/common.md#clear-and-simple-design A direct length query answers declaration count without conflating it with Checker_getMinArgumentCount.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No constructor convention alters the count; it is computed from the actual signature parameter slice.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain rest/this counting, the distinction from minimum arity and nil zero with useful examples.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Signature_parameterCount acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Signature_parameterCount performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Signature_parameterCount computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Signature_parameterCount computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
// The returned slice is compiler-owned; callers must not mutate it.
//
// @evidence contracts/common.md#principled-implementation Returning the signature's existing ordered value-parameter symbols preserves their declaration order and checker identity, with this represented separately upstream.
// @evidence contracts/common.md#clear-and-simple-design One accessor exposes the same slice counted by Signature_parameterCount, avoiding a copied shim parameter representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The accessor does not create synthetic seed parameters or filter parameters for a particular consumer strategy.
// @evidence contracts/common.md#meaningful-documentation Native prose states value/this separation, declaration order, nil behavior and compiler-owned immutable-by-caller slice use.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Signature_parameters acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Signature_parameters performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Signature_parameters computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Signature_parameters computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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
//
// @evidence contracts/common.md#principled-implementation Upstream rest-parameter flags distinguish a spread parameter declaration from an ordinary array-typed parameter, independent of whether it is the sole parameter.
// @evidence contracts/common.md#clear-and-simple-design One predicate exposes declaration shape separately from parameter count and rest element typing.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Array typing is not used as a shortcut for rest syntax; actual signature flags decide the result.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain rest-only versus leading-required cases, array ambiguity and nil false without replacing the actual predicate's domain.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Signature_hasRestParameter acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Signature_hasRestParameter performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Signature_hasRestParameter computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Signature_hasRestParameter computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Signature_hasRestParameter(signature *innerchecker.Signature) bool {
  if signature == nil {
    return false
  }
  return signature.HasRestParameter()
}

// Checker_getRestTypeOfSignature returns the ELEMENT type of the signature's
// rest parameter (`...xs: S[]` -> S; a tuple rest uses its variable rest part),
// which is the seed type for a rest-ONLY single-argument constructor/factory,
// matching ClassifiableSeed, which unwraps the rest to its element. When the
// signature has no derivable variable rest element it falls back to `any`
// upstream, including a fixed-length tuple rest. A
// leading-required + rest-tail `(s: S, ...r: R[])` has a rest parameter yet its
// seed is the FIRST parameter S, not the rest element. So take the rest element
// only when `Signature_hasRestParameter(sig) && Signature_parameterCount(sig) == 1`;
// otherwise read Signature_parameters(sig)[0]. Returns nil if recv or signature
// is nil.
//
// @evidence contracts/common.md#principled-implementation The compiler derives the last rest parameter's type, extracts a tuple's variable rest part when present, then applies numeric indexing; absent derivable rest typing returns upstream any rather than a fabricated fixed-tuple element union.
// @evidence contracts/common.md#clear-and-simple-design One query exposes rest element semantics independently of declared parameter count, so callers can distinguish a sole spread parameter from a required prefix.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Ordinary array parameters are not treated as rest declarations and fixed tuple-rest absence is not hidden with a guessed element type.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes variable tuple rest, any fallback, leading-prefix use and nil inputs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_getRestTypeOfSignature acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_getRestTypeOfSignature performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_getRestTypeOfSignature computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_getRestTypeOfSignature computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_getRestTypeOfSignature(recv *innerchecker.Checker, signature *innerchecker.Signature) *innerchecker.Type {
  if recv == nil || signature == nil {
    return nil
  }
  return recv.GetRestTypeOfSignature(signature)
}

//go:linkname checkerInstantiateType github.com/microsoft/typescript-go/internal/checker.(*Checker).instantiateType
func checkerInstantiateType(recv *innerchecker.Checker, t *innerchecker.Type, m *innerchecker.TypeMapper) *innerchecker.Type

//go:linkname checkerNewSimpleTypeMapper github.com/microsoft/typescript-go/internal/checker.newSimpleTypeMapper
func checkerNewSimpleTypeMapper(source *innerchecker.Type, target *innerchecker.Type) *innerchecker.TypeMapper

//go:linkname checkerNewTypeMapper github.com/microsoft/typescript-go/internal/checker.newTypeMapper
func checkerNewTypeMapper(sources []*innerchecker.Type, targets []*innerchecker.Type) *innerchecker.TypeMapper

// Checker_instantiateType substitutes the type parameters of `t` with the
// concrete types in `mapper`, returning the instantiated type. A type-transform
// plugin uses it to instantiate a generic class's constructor type with the
// reference's type arguments, so a type parameter nested inside a container
// (`A[]`, `[A, B]`) is substituted for free. Returns nil if recv or t is nil.
// Type and mapper entries must belong to recv; a nil mapper preserves the type.
//
// @evidence contracts/common.md#principled-implementation The compiler instantiator applies mapper identity through nested semantic type structure, preserving compiler type relationships instead of textual type-parameter replacement.
// @evidence contracts/common.md#clear-and-simple-design One instantiation bridge consumes the same mapper model exposed by constructors, avoiding a separate recursive type copier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Substitution uses actual type identities rather than parameter names or selected container special cases.
// @evidence contracts/common.md#meaningful-documentation Native prose explains nested substitution, nil result, nil mapper identity and producing-checker premises.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_instantiateType acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_instantiateType performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_instantiateType computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_instantiateType computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_instantiateType(recv *innerchecker.Checker, t *innerchecker.Type, mapper *innerchecker.TypeMapper) *innerchecker.Type {
  if recv == nil || t == nil {
    return nil
  }
  return checkerInstantiateType(recv, t, mapper)
}

// Checker_newSimpleTypeMapper builds a single-pair type mapper that substitutes
// `source` with `target`. It is the building block for instantiating a generic
// class's constructor type with its reference type arguments. Returns nil if
// source or target is nil.
// Source and target must belong to the same semantic checker context.
//
// @evidence contracts/common.md#principled-implementation Upstream's simple mapper records one source-type identity and its target, providing semantic substitution without name collisions.
// @evidence contracts/common.md#clear-and-simple-design The one-pair constructor is distinct from parallel and composed mappings, exposing the representation required for its actual operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed type-parameter name or fixed consumer class determines the mapping.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies one-pair substitution, nil refusal and same-context types.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Checker_newSimpleTypeMapper acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms Checker_newSimpleTypeMapper performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Checker_newSimpleTypeMapper computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_newSimpleTypeMapper computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_newSimpleTypeMapper(source *innerchecker.Type, target *innerchecker.Type) *innerchecker.TypeMapper {
  if source == nil || target == nil {
    return nil
  }
  return checkerNewSimpleTypeMapper(source, target)
}

// Checker_newTypeMapper builds a parallel type mapper from corresponding
// source and target slices. Unlike Checker_combineTypeMappers, it does not feed
// one substitution's target through later substitutions, so a mapping such as
// `[A, B] -> [B, A]` preserves both target identities. Returns nil when the
// slices are empty, differ in length, or contain nil types.
//
// The compiler retains the supplied slices; callers must not mutate them after
// construction, and all entries must belong to one semantic checker context.
//
// @evidence contracts/common.md#principled-implementation Parallel source/target identities are validated pairwise and passed to the compiler mapper without composing targets through other pairs, preserving simultaneous substitution such as a swap.
// @evidence contracts/common.md#clear-and-simple-design One constructor owns parallel-shape validation, separate from the explicitly compositional mapper operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid arrays are rejected rather than truncated, padded or converted into successive substitutions that change meaning.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain parallel-versus-composed substitution, a swap example, rejection conditions and retained-slice ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The mapper is returned to the caller and nothing else is retained.
// @evidenceExclude contracts/performance.md#efficient-algorithms One pass over the source and target pairs, linear in their count.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Builds one mapper per call from its arguments and shares nothing.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory type values only; it accesses no path or filesystem.
func Checker_newTypeMapper(sources []*innerchecker.Type, targets []*innerchecker.Type) *innerchecker.TypeMapper {
  if len(sources) == 0 || len(sources) != len(targets) {
    return nil
  }
  for i := range sources {
    if sources[i] == nil || targets[i] == nil {
      return nil
    }
  }
  return checkerNewTypeMapper(sources, targets)
}

//go:linkname checkerCombineTypeMappers github.com/microsoft/typescript-go/internal/checker.(*Checker).combineTypeMappers
func checkerCombineTypeMappers(recv *innerchecker.Checker, m1 *innerchecker.TypeMapper, m2 *innerchecker.TypeMapper) *innerchecker.TypeMapper

// Checker_combineTypeMappers composes two mapper stages. The first mapper's
// substituted target is instantiated through the second mapper, so use
// Checker_newTypeMapper instead when source and target slices are parallel
// declaration-parameter mappings. Returns m2 when m1 is nil, including when
// recv is nil. Returns nil when m1 is non-nil and recv or m2 is nil, because
// both are required to build a usable composite mapper.
//
// Types and mappers must belong to recv's semantic checker context.
//
// @evidence contracts/common.md#principled-implementation Upstream mapper composition instantiates the first stage's target through the second, while absent first stage acts as identity; a nonempty first stage requires both checker and second mapper.
// @evidence contracts/common.md#clear-and-simple-design Composition has its own named operation and explicit nil policy, distinct from simultaneous parallel parameter mapping.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The stages are composed by compiler semantics rather than flattened into a misleading pair list or repaired with arbitrary fallback types.
// @evidence contracts/common.md#meaningful-documentation Native prose states composition order, parallel alternative, all nil cases and same-checker premises.
// @evidence contracts/performance.md#bound-retention-and-release-resources The nonempty composition returns one upstream composite mapper retaining recv, m1 and m2; the caller owns its lifetime and the reachable checker/type state. Nil branches allocate no composite, and the wrapper keeps no separate handle or cache.
// @evidence contracts/performance.md#efficient-algorithms Fixed nil checks delegate to the upstream O(1) composite construction without visiting mapped types. Applying the returned mapper later owns first-stage mapping and second-stage instantiation costs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The wrapper transfers an existing second mapper or creates a caller-owned composition; it owns no semantic mapper cache or coordination of later mapping work, which belongs to the upstream checker.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Checker_combineTypeMappers computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func Checker_combineTypeMappers(recv *innerchecker.Checker, m1 *innerchecker.TypeMapper, m2 *innerchecker.TypeMapper) *innerchecker.TypeMapper {
  if m1 == nil {
    return m2
  }
  if recv == nil || m2 == nil {
    return nil
  }
  return checkerCombineTypeMappers(recv, m1, m2)
}
