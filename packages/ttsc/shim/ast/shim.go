// gen_shims:hand-maintained
//
// This authored shim exposes upstream AST identities and direct function
// adapters. gen_shims detects the first-line marker and preserves this file.

package ast

import (
  innerast "github.com/microsoft/typescript-go/internal/ast"
)

// CallExpression exposes the upstream call-expression payload without copying it.
//
// @evidence contracts/common.md#principled-implementation The alias preserves innerast.CallExpression identity and its AST methods.
// @evidence contracts/common.md#clear-and-simple-design One alias exposes call payloads without a parallel shim structure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Call payloads retain upstream fields rather than guessed consumer layouts.
// @evidence contracts/common.md#meaningful-documentation Native prose explains upstream payload identity, with a blank line before tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CallExpression = innerast.CallExpression

// Diagnostic exposes upstream AST diagnostics with their original fields and methods.
//
// @evidence contracts/common.md#principled-implementation Go aliasing preserves innerast.Diagnostic values without converting diagnostic state.
// @evidence contracts/common.md#clear-and-simple-design The original diagnostic type supplies the representation and behavior.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No shim diagnostic codes or expected messages replace upstream diagnostics.
// @evidence contracts/common.md#meaningful-documentation The comment identifies diagnostic ownership and preserved methods; prose and tags are separated.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Diagnostic = innerast.Diagnostic

// Identifier exposes the upstream identifier payload; IdentifierNode denotes its node role.
//
// @evidence contracts/common.md#principled-implementation The alias retains innerast.Identifier payload identity, distinct from its Node role alias.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns identifier fields instead of a duplicate shim payload.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Identifier storage is not inferred from spelling or a fixture layout.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes identifier payload from node role and separates tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Identifier = innerast.Identifier

// IdentifierNode exposes the upstream identifier node role, an alias of Node.
// It does not statically restrict the node's Kind to an identifier.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream Node identity; role naming does not introduce Go kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design One role alias matches upstream APIs without a second node wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No unchecked conversion or substitute identifier node is introduced.
// @evidence contracts/common.md#meaningful-documentation The comment states the role and lack of kind narrowing, with prose/tag separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type IdentifierNode = innerast.IdentifierNode

// ImportAttributesNode exposes the upstream Node role for an import-attributes clause.
// The alias retains Node identity rather than validating the clause kind.
//
// @evidence contracts/common.md#principled-implementation Aliasing innerast.ImportAttributesNode preserves the compiler's Node-backed clause representation.
// @evidence contracts/common.md#clear-and-simple-design The upstream clause role needs no extra shim container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No import-attribute fields are fabricated or consumer keys special-cased.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the clause role and permissive identity; tags follow a blank line.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportAttributesNode = innerast.ImportAttributesNode

// ImportClauseNode exposes the upstream Node role for import binding clauses.
// Kind validity remains the caller's responsibility because this is a Node alias.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity preserves the upstream import-clause role in compiler signatures.
// @evidence contracts/common.md#clear-and-simple-design Binding-clause storage remains with upstream Node rather than another wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No alternate import-binding representation bypasses upstream behavior.
// @evidence contracts/common.md#meaningful-documentation The comment explains binding purpose and kind responsibility with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportClauseNode = innerast.ImportClauseNode

// ImportPhaseModifierSyntaxKind names type/defer import phase kinds.
// Upstream aliases Kind, so Go does not enforce that two-kind subset.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream Kind identity while its documented role denotes type/defer phases.
// @evidence contracts/common.md#clear-and-simple-design The phase role reuses compiler kind codes without another enum.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Phase values remain upstream discriminants rather than hardcoded replacement codes.
// @evidence contracts/common.md#meaningful-documentation Native prose explains phase meaning and unchecked subset, separating tags from prose.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportPhaseModifierSyntaxKind = innerast.ImportPhaseModifierSyntaxKind

// ImportSpecifierList exposes upstream NodeList storage for ordered import specifiers.
// The role does not enforce element kinds or copy the contained node pointers.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves the upstream NodeList identity and specifier order.
// @evidence contracts/common.md#clear-and-simple-design Import-list APIs share upstream list storage rather than a converted collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No imported bindings are substituted or precomputed for a consumer.
// @evidence contracts/common.md#meaningful-documentation The comment explains list ordering, element limits and shared storage with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportSpecifierList = innerast.ImportSpecifierList

// IntersectionTypeNode exposes the upstream intersection-type payload and methods.
//
// @evidence contracts/common.md#principled-implementation The alias retains innerast.IntersectionTypeNode identity for compiler type operands.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns intersection payload fields without a shim mirror.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No semantic intersection result replaces the upstream syntax payload.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the intersection payload and preserved methods, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type IntersectionTypeNode = innerast.IntersectionTypeNode

// Kind exposes the upstream syntax discriminant and its numeric identity.
// Not every Kind is a token or valid in every syntax position.
//
// @evidence contracts/common.md#principled-implementation Aliasing innerast.Kind keeps compiler discriminants identical across the plugin boundary.
// @evidence contracts/common.md#clear-and-simple-design One kind type shares upstream enums without a translation table.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The shim neither renumbers kinds nor recognizes fixture-specific codes.
// @evidence contracts/common.md#meaningful-documentation The comment explains discriminant identity and context limits; tags are separated.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Kind = innerast.Kind

// KeywordExpressionSyntaxKind names upstream keyword expression kinds.
// This is a Kind alias rather than a Go-enforced keyword subset.
//
// @evidence contracts/common.md#principled-implementation Upstream Kind identity is retained for the keyword-expression role without false narrowing.
// @evidence contracts/common.md#clear-and-simple-design The role uses the existing kind type instead of another enum.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Keyword codes remain upstream values rather than guessed parser constants.
// @evidence contracts/common.md#meaningful-documentation Native prose explains expression-keyword purpose and unrestricted alias identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type KeywordExpressionSyntaxKind = innerast.KeywordExpressionSyntaxKind

// KeywordTypeSyntaxKind names upstream primitive type keyword kinds.
// This Kind alias does not itself reject other syntax kinds.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves compiler kind identity while documenting the intended type-keyword role.
// @evidence contracts/common.md#clear-and-simple-design The role shares Kind storage without a redundant keyword enum.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No independent list of guessed keyword codes replaces upstream identity.
// @evidence contracts/common.md#meaningful-documentation The native comment states the role and nonvalidation boundary, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type KeywordTypeSyntaxKind = innerast.KeywordTypeSyntaxKind

// LiteralTypeNode exposes the upstream literal-type payload without interpreting its value.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves innerast.LiteralTypeNode syntax fields and methods.
// @evidence contracts/common.md#clear-and-simple-design The upstream payload owns literal-type representation without a shim duplicate.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Literal syntax is not replaced by precomputed type results.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies literal payload ownership and its nonevaluating boundary.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LiteralTypeNode = innerast.LiteralTypeNode

// NoSubstitutionTemplateLiteral exposes the upstream template payload with no interpolation.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains the upstream no-substitution template's payload and methods.
// @evidence contracts/common.md#clear-and-simple-design Template storage stays upstream instead of a second shim text container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The shim does not invent template spelling or consumer-specific escaping.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes the no-interpolation form and separates tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NoSubstitutionTemplateLiteral = innerast.NoSubstitutionTemplateLiteral

// Node exposes the compiler's AST node identity, methods and mutable parent links.
// Callers must respect the owning compiler's node lifetime and kind/payload invariants.
//
// @evidence contracts/common.md#principled-implementation Go aliasing preserves innerast.Node identity without copying payloads or severing parent links.
// @evidence contracts/common.md#clear-and-simple-design The compiler node itself supplies storage and methods across the shim boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No reconstructed node layout or foreign-method replacement is introduced.
// @evidence contracts/common.md#meaningful-documentation The comment identifies shared identity, mutable links and owner invariants with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Node = innerast.Node

// NodeFactory exposes the upstream AST allocator, creation methods and hook behavior.
// Use a factory within the lifetime and concurrency rules of its compiler owner.
//
// @evidence contracts/common.md#principled-implementation The alias preserves the upstream factory's methods and allocation state exactly.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns node creation rather than an independent shim allocator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign allocator fields or creation methods are monkey patched.
// @evidence contracts/common.md#meaningful-documentation Native prose describes creation ownership and lifetime/concurrency responsibility, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeFactory = innerast.NodeFactory

// NodeFactoryHooks exposes supported creation, update and clone callbacks.
// The zero value leaves upstream factory behavior unintercepted.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves the upstream hook signatures and zero-value semantics.
// @evidence contracts/common.md#clear-and-simple-design The existing callback bundle owns all factory interception roles.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Hooks expose supported injection instead of replacing foreign factory methods.
// @evidence contracts/common.md#meaningful-documentation The comment identifies callback roles and zero-value behavior, separating tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeFactoryHooks = innerast.NodeFactoryHooks

// NodeVisitor exposes the upstream visitor callback, recreation factory and hooks.
// Construction alone does not start a tree traversal.
//
// @evidence contracts/common.md#principled-implementation The alias retains upstream visitor methods and callback state for explicit traversal.
// @evidence contracts/common.md#clear-and-simple-design One upstream visitor owns traversal behavior without a shim traversal engine.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The shim introduces no fixture-specific visitation or foreign method mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains visitor roles and the construction/traversal distinction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeVisitor = innerast.NodeVisitor

// NodeVisitorHooks exposes upstream interception callbacks for child visitation roles.
// The zero value keeps the visitor's default child-processing behavior.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves each upstream visitation hook signature and default omission.
// @evidence contracts/common.md#clear-and-simple-design Existing role-based callbacks avoid an additional shim policy layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported hooks supply interception without monkey patching visitor internals.
// @evidence contracts/common.md#meaningful-documentation Native prose states hook responsibility and omitted-hook behavior, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeVisitorHooks = innerast.NodeVisitorHooks

// TokenFlags exposes the upstream bitmask describing token scanning metadata.
//
// @evidence contracts/common.md#principled-implementation Aliasing keeps innerast.TokenFlags bit identity compatible with compiler tokens.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns the flag type and values without a converted mask.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No shim-specific token bits replace the documented upstream flags.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies token metadata and upstream bitmask ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TokenFlags = innerast.TokenFlags

// ModifierList exposes the upstream modifier list and its combined modifier flags.
// Nodes and source range remain shared with the compiler list.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream ModifierList storage, flags and list methods together.
// @evidence contracts/common.md#clear-and-simple-design Existing modifier-list structure owns aggregation without a parallel shim cache.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific modifier bits or reconstructed lists are injected.
// @evidence contracts/common.md#meaningful-documentation Native prose explains combined flags and shared nodes/range, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModifierList = innerast.ModifierList

// StatementList names upstream NodeList storage for ordered statements.
// The role name does not statically constrain element kinds.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves the upstream ordered NodeList and statement role.
// @evidence contracts/common.md#clear-and-simple-design Statement APIs reuse compiler list storage without a converted sequence.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known statement sequence substitutes for the compiler list.
// @evidence contracts/common.md#meaningful-documentation Native prose explains ordering and the nonnarrowing role, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type StatementList = innerast.StatementList

// VariableDeclarationNodeList names upstream NodeList storage for variable bindings.
// It does not add Go element-kind validation.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves the upstream binding-list representation and element order.
// @evidence contracts/common.md#clear-and-simple-design Variable-binding APIs reuse NodeList rather than a second collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bindings are not copied into a guessed consumer-specific list representation.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies binding-list use and element validation limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type VariableDeclarationNodeList = innerast.VariableDeclarationNodeList

// BindingElementList names upstream NodeList storage for destructuring elements.
// Its role does not statically restrict contained Node kinds.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream list identity and destructuring element order.
// @evidence contracts/common.md#clear-and-simple-design Existing NodeList storage supplies the binding-element collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture-derived destructuring elements replace supplied compiler nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose states destructuring purpose and nonnarrowing list identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BindingElementList = innerast.BindingElementList

// TypeParameterList names upstream NodeList storage for ordered generic parameters.
// The role does not enforce each element's kind.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains upstream generic-parameter list order and methods.
// @evidence contracts/common.md#clear-and-simple-design Generic-parameter collections reuse NodeList without another storage type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed generic defaults or fixture parameter lists are substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose describes generic ordering and element-kind responsibility.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeParameterList = innerast.TypeParameterList

// ParameterList names upstream NodeList storage for ordered function parameters.
// Node kinds and declaration validity remain upstream/caller responsibilities.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream parameter-list identity and declaration order.
// @evidence contracts/common.md#clear-and-simple-design Parameter APIs share the compiler's list rather than a duplicate parameter collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No special parameter names or fixture signatures are encoded.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies parameter order and alias validation limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ParameterList = innerast.ParameterList

// ElementList names upstream NodeList storage for ordered expression elements.
// It is a role alias rather than a Go-enforced expression collection.
//
// @evidence contracts/common.md#principled-implementation Upstream NodeList identity and element order remain unchanged through this alias.
// @evidence contracts/common.md#clear-and-simple-design Expression-list APIs use existing compiler collection methods without conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No computed expression results or consumer-specific elements replace nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes expression-list purpose from static kind validation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ElementList = innerast.ElementList

// TypeList names upstream NodeList storage for ordered type syntax nodes.
// It does not establish assignability or constrain element kinds in Go.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves the compiler type-syntax list identity and ordering.
// @evidence contracts/common.md#clear-and-simple-design Type operand collections reuse NodeList instead of a semantic type container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No precomputed type answers substitute for upstream syntax nodes.
// @evidence contracts/common.md#meaningful-documentation The native comment separates syntax ordering from semantic and kind checks.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeList = innerast.TypeList

// TypeElementList names upstream NodeList storage for interface or object-type members.
// The role does not enforce member kinds or member compatibility.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream member-list identity and printed declaration order.
// @evidence contracts/common.md#clear-and-simple-design Member collections share NodeList storage without an independent shim member map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed interface members or consumer-specific compatibility declarations are introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies member contexts and nonvalidation limits with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeElementList = innerast.TypeElementList

// Statement exposes the upstream statement role, an alias of Node.
// Its name does not establish legal statement placement or restrict Kind in Go.
//
// @evidence contracts/common.md#principled-implementation Exact Node identity preserves statement-role signatures without false kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design Statement behavior remains on upstream Node rather than a shim wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No simulated control flow or test-selected statement representation is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the statement role and placement/kind limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Statement = innerast.Statement

// Expression exposes the upstream expression role, an alias of Node.
// It does not evaluate expressions or statically enforce expression kinds.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream Node identity for expression-role APIs.
// @evidence contracts/common.md#clear-and-simple-design Expressions retain Node methods without another shim expression hierarchy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No precomputed value replaces an upstream expression node.
// @evidence contracts/common.md#meaningful-documentation The native comment distinguishes syntax identity from evaluation and kind enforcement.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Expression = innerast.Expression

// TypeNode exposes the upstream type-syntax role, an alias of Node.
// It does not represent a resolved checker type or enforce a kind subset in Go.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream Node identity for type-syntax operands, not semantic checker types.
// @evidence contracts/common.md#clear-and-simple-design Type syntax shares Node storage and methods without another shim type model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed checker result or alternate semantic type representation is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose separates syntax from resolved types and documents nonnarrowing identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeNode = innerast.TypeNode

// TypePredicateParameterName names the upstream identifier/this predicate-target role.
// It aliases Node and does not enforce those alternatives in Go.
//
// @evidence contracts/common.md#principled-implementation Exact upstream Node identity preserves the predicate-target role without claiming static narrowing.
// @evidence contracts/common.md#clear-and-simple-design Predicate targets use one upstream role alias instead of a converted name wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No hardcoded narrowing target or computed predicate outcome is embedded.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies identifier/this intent and Go kind-validation limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypePredicateParameterName = innerast.TypePredicateParameterName

// AssertsKeyword names the upstream Node role for an asserts keyword.
// This Node alias does not statically enforce KindAssertsKeyword.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream keyword-node identity rather than inventing a narrowed Go node type.
// @evidence contracts/common.md#clear-and-simple-design The keyword role shares Node representation without duplicate token storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Asserts identity remains language syntax instead of a fixture-dependent predicate marker.
// @evidence contracts/common.md#meaningful-documentation Native prose explains keyword intent and the nonnarrowing alias, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type AssertsKeyword = innerast.AssertsKeyword

// BindingName names the upstream identifier/destructuring binding role.
// This Node alias does not enforce binding grammar or name resolution.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains the upstream binding role without converting identifier or pattern nodes.
// @evidence contracts/common.md#clear-and-simple-design Binding-name APIs share Node rather than a second pattern representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific binding spelling or guessed symbol identity is encoded.
// @evidence contracts/common.md#meaningful-documentation The comment states binding alternatives and unchecked grammar/resolution boundaries.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BindingName = innerast.BindingName

// BinaryOperatorToken names upstream binary-operator tokens using Node identity.
// Its role does not statically restrict token kinds in Go.
//
// @evidence contracts/common.md#principled-implementation Go aliasing preserves the compiler's binary-token representation and methods.
// @evidence contracts/common.md#clear-and-simple-design Operator tokens reuse Node without a separate shim operator payload.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias does not replace operator codes with fixture-specific values.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies binary-token purpose and unrestricted alias identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BinaryOperatorToken = innerast.BinaryOperatorToken

// PropertyName names upstream member-key syntax, including computed and literal names.
// It aliases Node and leaves contextual name legality to the caller/compiler.
//
// @evidence contracts/common.md#principled-implementation Exact upstream alias identity preserves diverse property-name node forms without static kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design Name consumers share Node storage instead of a shim key-value conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No property-name whitelist or consumer-key workaround is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies key forms and contextual legality limits, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PropertyName = innerast.PropertyName

// MemberName names the upstream identifier/private-identifier member role.
// It aliases Node without statically checking the member-name kind.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains upstream member-name nodes without false Go kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design Member names reuse Node rather than another shim name wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer member names or guessed private-name payloads are substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies member alternatives and the nonnarrowing boundary.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type MemberName = innerast.MemberName

// EntityName names the upstream identifier/qualified-name entity role.
// This Node alias leaves qualification validity and binding resolution unchecked.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream entity-node identity without converting qualification structure.
// @evidence contracts/common.md#clear-and-simple-design Entity-name APIs share Node instead of another name hierarchy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No module or entity names are special-cased for consumers.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies qualification alternatives and resolution/kind limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EntityName = innerast.EntityName

// ModuleExportName names upstream identifier/string-literal module binding names.
// Go retains Node identity rather than enforcing those two alternatives.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream quoted and identifier name representations without static narrowing.
// @evidence contracts/common.md#clear-and-simple-design Module-name consumers share compiler nodes without a spelling conversion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer export names or artificial aliases replace source names.
// @evidence contracts/common.md#meaningful-documentation The comment explains quoted/identifier intent and Go validation limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModuleExportName = innerast.ModuleExportName

// NamedImportBindings names upstream namespace or named import binding clauses.
// This Node alias does not statically validate the clause kind.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream namespace/named binding nodes for import APIs.
// @evidence contracts/common.md#clear-and-simple-design One upstream role reuses Node without a second binding container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture-specific binding list or loader workaround is represented.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies both clause forms and nonnarrowing identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NamedImportBindings = innerast.NamedImportBindings

// ConciseBody names the upstream block/expression function-body role.
// It is a Node alias, so callers must provide a context-appropriate body.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves block and expression body nodes without Go kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design Function-body APIs share Node instead of duplicate body wrappers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No synthesized fixture body or runtime function replacement is introduced.
// @evidence contracts/common.md#meaningful-documentation The comment explains body alternatives and context responsibility.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ConciseBody = innerast.ConciseBody

// TemplateSpanList names upstream NodeList storage for interpolation spans.
// Element kinds and template closure are not enforced by the Go alias.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream span-list ordering and shared NodeList identity.
// @evidence contracts/common.md#clear-and-simple-design Span sequences reuse compiler lists without a second template collection.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No precomputed interpolation output replaces span nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies span ordering and kind/closure limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateSpanList = innerast.TemplateSpanList

// TemplateMiddleOrTail names the upstream continued/closing template segment role.
// This Node alias does not enforce that kind distinction in Go.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains upstream middle/tail segment nodes without static narrowing.
// @evidence contracts/common.md#clear-and-simple-design Segment-role APIs share Node instead of another literal wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed terminal segment or fixture text replaces upstream nodes.
// @evidence contracts/common.md#meaningful-documentation The comment explains continued/closing roles and the alias restriction limit.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateMiddleOrTail = innerast.TemplateMiddleOrTail

// TemplateHeadNode names the upstream Node role for a template's leading segment.
// It does not statically constrain Kind to a template head.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves the upstream head-node role without narrowing Node in Go.
// @evidence contracts/common.md#clear-and-simple-design Head-node consumers share Node rather than another segment wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No hardcoded leading template text is embedded in the alias.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the leading-segment role and kind limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateHeadNode = innerast.TemplateHeadNode

// QuestionDotToken names the upstream optional-chain marker node role.
// The Node alias does not itself enforce the question-dot token kind.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains the optional-chain marker representation without Go kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design The marker role shares Node storage without a second punctuation payload.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The role denotes language punctuation rather than a consumer-specific optionality hack.
// @evidence contracts/common.md#meaningful-documentation The comment describes optional-chain intent and unchecked kind identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type QuestionDotToken = innerast.QuestionDotToken

// QuestionToken names the upstream question-mark node role.
// This Node alias leaves the token kind and placement unchecked.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream question-token identity without asserting context validity.
// @evidence contracts/common.md#clear-and-simple-design Question-mark consumers reuse Node instead of duplicate marker storage.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture-dependent optional marker or alternative token code is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies punctuation purpose and placement/kind limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type QuestionToken = innerast.QuestionToken

// DotDotDotToken names the upstream rest/spread marker node role.
// It aliases Node without statically enforcing the token kind or context.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains upstream rest/spread token nodes without static kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design The marker role shares compiler Node storage rather than another token wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-selected rest/spread spelling replaces upstream token identity.
// @evidence contracts/common.md#meaningful-documentation The comment states rest/spread intent and validation limits with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type DotDotDotToken = innerast.DotDotDotToken

// ExclamationToken names the upstream exclamation marker node role.
// The Node alias does not establish definite-assignment or assertion legality.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream exclamation nodes while leaving kind and placement to callers.
// @evidence contracts/common.md#clear-and-simple-design The marker shares Node representation without another shim assertion type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No inferred assertion result or consumer-specific marker is embedded.
// @evidence contracts/common.md#meaningful-documentation Native prose explains marker identity and contextual legality boundaries.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExclamationToken = innerast.ExclamationToken

// EqualsGreaterThanToken names the upstream arrow punctuation node role.
// This Node alias does not statically enforce the arrow kind.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves arrow-token nodes without inventing kind narrowing.
// @evidence contracts/common.md#clear-and-simple-design Arrow markers reuse Node storage instead of another punctuation wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The role uses upstream punctuation identity rather than guessed parser codes.
// @evidence contracts/common.md#meaningful-documentation The native comment describes arrow purpose and the nonnarrowing boundary.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EqualsGreaterThanToken = innerast.EqualsGreaterThanToken

// AsteriskToken names the upstream asterisk marker node role.
// It retains Node identity without enforcing the marker's kind or placement.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream asterisk nodes while leaving syntax-context validation unchanged.
// @evidence contracts/common.md#clear-and-simple-design Asterisk consumers share Node rather than a second marker structure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture-specific generator marker or alternate token value is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies marker purpose and unchecked placement/kind limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type AsteriskToken = innerast.AsteriskToken

// TokenNode names upstream lexical token nodes using the general Node identity.
// Its name does not restrict Kind to the lexical token range in Go.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream token-node identity without claiming Go-enforced token narrowing.
// @evidence contracts/common.md#clear-and-simple-design Token operations reuse compiler Node storage without a shim token hierarchy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No alternative lexical representation or fixture token is substituted.
// @evidence contracts/common.md#meaningful-documentation The comment distinguishes lexical role from static kind restriction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TokenNode = innerast.TokenNode

// TemplateHead exposes the upstream leading template-segment payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains innerast.TemplateHead fields and AST methods for leading text.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns leading-segment storage without a shim text mirror.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed raw/cooked spelling replaces compiler template data.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the leading-segment payload and upstream ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateHead = innerast.TemplateHead

// TemplateLiteralTypeNode exposes the upstream interpolated template-type payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves innerast.TemplateLiteralTypeNode interpolation fields and methods.
// @evidence contracts/common.md#clear-and-simple-design The upstream payload owns type-template structure without a shim duplicate.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No precomputed template type result replaces syntax operands.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies interpolated type syntax and payload ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateLiteralTypeNode = innerast.TemplateLiteralTypeNode

// TemplateLiteralTypeSpan exposes one upstream type interpolation and following literal segment.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream span operands and AST methods without conversion.
// @evidence contracts/common.md#clear-and-simple-design The upstream span owns interpolation structure instead of a shim pair representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed type expansion or fixture segment is inserted.
// @evidence contracts/common.md#meaningful-documentation Native prose states the span's two roles and upstream ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateLiteralTypeSpan = innerast.TemplateLiteralTypeSpan

// TemplateMiddle exposes the upstream template segment continuing another interpolation.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains innerast.TemplateMiddle payload identity and methods.
// @evidence contracts/common.md#clear-and-simple-design Continued-segment storage remains upstream instead of duplicated shim text.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated interpolation delimiter or consumer text replaces compiler data.
// @evidence contracts/common.md#meaningful-documentation The comment identifies the continued-segment role with separated acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateMiddle = innerast.TemplateMiddle

// TemplateTail exposes the upstream final literal segment closing a template.
//
// @evidence contracts/common.md#principled-implementation The alias preserves innerast.TemplateTail payload and methods for closing segments.
// @evidence contracts/common.md#clear-and-simple-design Closing text remains in its upstream payload without a shim terminal wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture-specific template closure is synthesized by this alias.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the final-segment role and separates tags from prose.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateTail = innerast.TemplateTail

// PrefixUnaryExpression exposes the upstream prefix-operator expression payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream operator/operand fields and expression methods.
// @evidence contracts/common.md#clear-and-simple-design Prefix expression structure remains upstream without a shim evaluator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No precomputed unary result replaces the represented expression.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies prefix syntax and preserved payload ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PrefixUnaryExpression = innerast.PrefixUnaryExpression

// ComputedPropertyName exposes the upstream expression-backed member-name payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream computed-name operands and AST methods.
// @evidence contracts/common.md#clear-and-simple-design The upstream name payload owns its expression without a shim key evaluator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No precomputed property key replaces the compiler expression.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies expression-backed names and separates acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ComputedPropertyName = innerast.ComputedPropertyName

// PropertySignatureDeclaration exposes the upstream interface/object-type property payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream property-signature fields and methods.
// @evidence contracts/common.md#clear-and-simple-design Type-member representation stays upstream rather than a shim property schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific interface properties or copied layouts are injected.
// @evidence contracts/common.md#meaningful-documentation The comment identifies type-member context and upstream declaration ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PropertySignatureDeclaration = innerast.PropertySignatureDeclaration

// QualifiedName exposes the upstream dotted entity-name payload and AST methods.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream qualification operands without converting name identity.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns dotted-name structure instead of a shim string-flattening layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No special entity paths or guessed binding results are introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies dotted entity payloads and preserved methods.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type QualifiedName = innerast.QualifiedName

// TypeLiteralNode exposes the upstream inline object-type member payload.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains upstream type-member structure and methods.
// @evidence contracts/common.md#clear-and-simple-design Object-type syntax remains upstream without a duplicate shim member map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known fixture shape replaces the actual compiler members.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies inline type syntax and payload ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeLiteralNode = innerast.TypeLiteralNode

// FunctionTypeNode exposes the upstream function-type signature payload.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream signature operands and AST methods without semantic conversion.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns function-type structure without a shim callable model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture signature or inferred callable result replaces upstream syntax.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies function-type syntax and upstream signature ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type FunctionTypeNode = innerast.FunctionTypeNode

// InterfaceDeclaration exposes the upstream named interface declaration payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves upstream interface fields and declaration methods.
// @evidence contracts/common.md#clear-and-simple-design Interface representation remains upstream without another shim declaration hierarchy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific compatibility interface is synthesized by the alias.
// @evidence contracts/common.md#meaningful-documentation The comment identifies interface declaration payloads and shared methods.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type InterfaceDeclaration = innerast.InterfaceDeclaration

// TypeReferenceNode exposes the upstream named generic type-reference payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains upstream names/type arguments without resolving them in the shim.
// @evidence contracts/common.md#clear-and-simple-design Type-reference syntax remains in the upstream payload instead of a shim resolver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific type-name mapping or guessed binding is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies named/generic reference syntax and separates tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeReferenceNode = innerast.TypeReferenceNode

// SourceFile exposes the upstream parsed-source owner, text access and AST methods.
// Source and lazy compiler metadata remain owned by the originating compiler context.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves upstream source-file identity, metadata and tree access.
// @evidence contracts/common.md#clear-and-simple-design The compiler SourceFile supplies ownership instead of a shim text/tree copy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific source text or reconstructed parse tree is substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose explains source ownership, metadata and shared methods with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SourceFile = innerast.SourceFile

// StringLiteral exposes the upstream quoted-string syntax payload and methods.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains upstream literal data without independently decoding or escaping it.
// @evidence contracts/common.md#clear-and-simple-design String syntax storage remains upstream instead of another shim string wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture text or consumer escape policy replaces compiler data.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies string syntax ownership and separates acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type StringLiteral = innerast.StringLiteral

// Symbol exposes the upstream bound-symbol identity and compiler metadata.
// It is not reconstructed from an identifier spelling by the shim.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves compiler symbol identity and relationships across plugin APIs.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns symbol storage and methods without a shim binding table.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed symbol identity or fixture-specific binding is substituted.
// @evidence contracts/common.md#meaningful-documentation The comment explains bound-symbol ownership and spelling/identity distinction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Symbol = innerast.Symbol

// SymbolFlags exposes the upstream bitmask describing symbol categories and properties.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves innerast.SymbolFlags bits for compiler symbol queries.
// @evidence contracts/common.md#clear-and-simple-design The shim shares upstream flags without an independent classification enum.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No alternate symbol codes or fixture categories replace upstream bits.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies symbol-bitmask purpose and upstream ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SymbolFlags = innerast.SymbolFlags

// NumericLiteral exposes the upstream numeric-literal syntax payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains compiler literal data and methods without shim number conversion.
// @evidence contracts/common.md#clear-and-simple-design Numeric syntax remains upstream rather than a second parsed-number model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No expected numeric answer replaces the compiler literal representation.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies numeric syntax payloads with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NumericLiteral = innerast.NumericLiteral

// BigIntLiteral exposes the upstream bigint-literal syntax payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains upstream bigint spelling/data and methods without numeric coercion.
// @evidence contracts/common.md#clear-and-simple-design Bigint syntax stays upstream instead of another shim numeric container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture bigint value or lossy numeric replacement is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies bigint syntax and upstream payload ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BigIntLiteral = innerast.BigIntLiteral

// ArrayTypeNode exposes the upstream element-type array syntax payload.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity preserves upstream array-type operands and methods.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns array syntax without another shim type container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer element type or evaluated array type replaces syntax.
// @evidence contracts/common.md#meaningful-documentation The comment identifies array-type syntax and preserved payload ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ArrayTypeNode = innerast.ArrayTypeNode

// IndexSignatureDeclaration exposes the upstream indexed type-member signature payload.
//
// @evidence contracts/common.md#principled-implementation Aliasing retains upstream index-signature parameters/type operands and methods.
// @evidence contracts/common.md#clear-and-simple-design The upstream declaration owns signature structure without a shim key/value schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture key domain or consumer index result is encoded.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies indexed type-member purpose and separates tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type IndexSignatureDeclaration = innerast.IndexSignatureDeclaration

// NamedTupleMember exposes the upstream labeled tuple-element payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves upstream tuple label, type and marker data.
// @evidence contracts/common.md#clear-and-simple-design Labeled elements stay in the compiler payload rather than a shim tuple schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known tuple labels or fixture positions are substituted.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies labeled tuple syntax and upstream ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NamedTupleMember = innerast.NamedTupleMember

// OptionalTypeNode exposes the upstream optional tuple-element type payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream optional type operands and methods.
// @evidence contracts/common.md#clear-and-simple-design Optional syntax remains upstream instead of a shim nullable-type conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed union or consumer-specific optionality replaces the syntax node.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies tuple optionality and separates acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type OptionalTypeNode = innerast.OptionalTypeNode

// RestTypeNode exposes the upstream rest tuple-element type payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream rest-type operand identity and methods.
// @evidence contracts/common.md#clear-and-simple-design Rest syntax stays upstream without another shim variadic representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture tuple expansion or consumer rest rule is injected.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies tuple rest syntax and payload ownership.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type RestTypeNode = innerast.RestTypeNode

// TypeAliasDeclaration exposes the upstream named type-alias declaration payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream target syntax, generic clauses and declaration methods.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns alias declarations without an independent shim type resolver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture alias target or guessed semantic type replaces syntax.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies named type-alias syntax and separates tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeAliasDeclaration = innerast.TypeAliasDeclaration

// TypeParameterDeclaration exposes upstream generic parameter names and constraint/default syntax.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream generic parameter fields and AST methods.
// @evidence contracts/common.md#clear-and-simple-design Parameter clauses remain upstream rather than a shim generic-policy model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed constraint or consumer-specific generic default is supplied.
// @evidence contracts/common.md#meaningful-documentation The comment identifies generic parameter clause roles with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeParameterDeclaration = innerast.TypeParameterDeclaration

// TupleTypeNode exposes the upstream ordered tuple-type element payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity preserves upstream tuple positions and node methods without type evaluation.
// @evidence contracts/common.md#clear-and-simple-design Tuple syntax remains upstream instead of another shim positional schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture tuple length or precomputed tuple result is substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies ordered tuple syntax and separates acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TupleTypeNode = innerast.TupleTypeNode

// UnionTypeNode exposes the upstream ordered union-type operand payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves upstream union operands and methods without semantic simplification.
// @evidence contracts/common.md#clear-and-simple-design Union syntax remains in the compiler payload instead of a shim type-set model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed union result or fixture constituent set replaces syntax.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies union syntax and preserved upstream payloads.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type UnionTypeNode = innerast.UnionTypeNode

// MethodSignatureDeclaration exposes the upstream interface/object-type method signature.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains upstream method-name and signature fields and methods.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns member-signature structure without a shim callable wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer method name or fixture callable shape is synthesized.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies type-member method context and separates tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type MethodSignatureDeclaration = innerast.MethodSignatureDeclaration

// MethodDeclaration exposes the upstream executable/bodyless method declaration payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing preserves upstream method clauses and optional body identity.
// @evidence contracts/common.md#clear-and-simple-design Method syntax remains upstream rather than a duplicate shim callable structure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No runtime method replacement or fixture implementation is introduced.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies declaration/body roles and preserved upstream payloads.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type MethodDeclaration = innerast.MethodDeclaration

// NodeList exposes the upstream ordered node pointers and source range.
// Aliasing does not copy the slice or transfer ownership of its nodes.
//
// @evidence contracts/common.md#principled-implementation Exact alias identity retains NodeList nodes, source range and list methods together.
// @evidence contracts/common.md#clear-and-simple-design Compiler collections retain their original list type without a conversion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No reconstructed source ranges or fixture node sequences are substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose explains ordering, range and shared ownership with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeList = innerast.NodeList

// ParameterDeclaration exposes the upstream parameter binding, markers and annotation payload.
//
// @evidence contracts/common.md#principled-implementation Alias identity retains upstream parameter clauses and declaration methods without conversion.
// @evidence contracts/common.md#clear-and-simple-design Parameter syntax remains upstream rather than a duplicate shim argument schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer parameter names or guessed optionality rules are injected.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies parameter clause roles and separates acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ParameterDeclaration = innerast.ParameterDeclaration

// ParenthesizedTypeNode exposes the upstream explicit type-grouping payload.
//
// @evidence contracts/common.md#principled-implementation Exact aliasing retains upstream grouping operands and AST methods without removing parentheses.
// @evidence contracts/common.md#clear-and-simple-design Grouping syntax remains in its upstream payload instead of another shim type wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture-selected parentheses or semantic substitution is introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies explicit grouping and upstream ownership with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream creation hooks and returns its factory allocation unchanged.
// @evidence contracts/common.md#clear-and-simple-design One adapter exposes factory construction without another allocator or hook layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported upstream hooks provide injection without replacing foreign creation methods.
// @evidence contracts/common.md#meaningful-documentation Native prose explains hook input and zero-value behavior with a blank line before tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewNodeFactory acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewNodeFactory performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewNodeFactory computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewNodeFactory computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewNodeFactory(options NodeFactoryHooks) *NodeFactory {
  return innerast.NewNodeFactory(options)
}

// GetNextJSDocCommentLocation returns the next enclosing JSDoc attachment host,
// or nil when no supported host remains. Supply a nonnil node from a valid
// parent-linked tree; a variable declaration list must have a first declaration.
// Only that first declaration advances through its list.
//
// @evidence contracts/common.md#principled-implementation The upstream parent-kind and first-declaration checks preserve JSDoc attachment semantics rather than treating every ancestor as a comment host.
// @evidence contracts/common.md#clear-and-simple-design One traversal step exposes upstream ownership; callers control repeated traversal and termination.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter follows real AST parents without fabricated attachment nodes or foreign method replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the endpoint, nil termination, nonnil input and first-declaration boundary.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetNextJSDocCommentLocation acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent attachment-search algorithm. Upstream checks one parent kind and, for a declaration list, its first element in O(1) time and space; repeated ascent belongs to the caller.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding step owns no cache or in-flight coordination; tree owners and traversal callers establish validity across changes to parent links or declaration order.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetNextJSDocCommentLocation computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetNextJSDocCommentLocation(node *Node) *Node {
  return innerast.GetNextJSDocCommentLocation(node)
}

// IsAmbientModuleSymbolName reports whether a symbol name has the compiler's
// quoted ambient-module spelling. It classifies spelling, not module existence.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves the upstream quotation test without conflating a symbol name with a resolved module.
// @evidence contracts/common.md#clear-and-simple-design One spelling predicate needs no filesystem lookup or separate module-name representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied name determines the result without consumer-specific module names.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes lexical symbol spelling from semantic existence.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsAmbientModuleSymbolName acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent name-classification algorithm. Upstream checks one-byte quote prefix and suffix, costing O(1) time and space without scanning the name's interior.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This lexical forwarding predicate owns no completed-result cache or in-flight coordination.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsAmbientModuleSymbolName computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsAmbientModuleSymbolName(name string) bool {
  return innerast.IsAmbientModuleSymbolName(name)
}

// IsImplicitlyExportedJSDocDeclaration recognizes a JS type-alias declaration
// or a reparsed module declaration directly parented by an external or CommonJS
// source file. Supply a nonnil node with a parent and valid compiler payloads.
//
// @evidence contracts/common.md#principled-implementation The upstream source-file/module gate admits JS type aliases or module declarations carrying the Reparsed flag without requiring that flag on type aliases.
// @evidence contracts/common.md#clear-and-simple-design One predicate keeps JSDoc export policy in its owning compiler implementation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Export status follows AST provenance rather than a printed declaration-name heuristic.
// @evidence contracts/common.md#meaningful-documentation Native prose states module context, reparsed provenance and required parent linkage.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsImplicitlyExportedJSDocDeclaration acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent export classifier. Upstream checks immediate parent kind, source-file module indicators and fixed declaration kind/flags in O(1) time and space without ancestor or content scans.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; compiler-tree owners establish validity of parent, module-indicator and declaration-flag inputs.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsImplicitlyExportedJSDocDeclaration computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsImplicitlyExportedJSDocDeclaration(node *Node) bool {
  return innerast.IsImplicitlyExportedJSDocDeclaration(node)
}

// IsNamedEvaluationSource classifies syntax that can supply an assigned name
// to a class, function or arrow function. node must be nonnil.
//
// @evidence contracts/common.md#principled-implementation Upstream kind, initializer and assignment-operator checks retain ECMAScript named-evaluation distinctions.
// @evidence contracts/common.md#clear-and-simple-design One classification bridge avoids a second syntax-kind table in plugin consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler classifies actual nodes without guessing runtime names from source text.
// @evidence contracts/common.md#meaningful-documentation Native prose names the assigned-name role and nonnil node premise.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsNamedEvaluationSource acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsNamedEvaluationSource performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsNamedEvaluationSource computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsNamedEvaluationSource computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsNamedEvaluationSource(node *Node) bool {
  return innerast.IsNamedEvaluationSource(node)
}

// IsProtoSetter classifies the identifier or string-literal property name
// __proto__. Computed property names do not qualify; node must be nonnil.
//
// @evidence contracts/common.md#principled-implementation Upstream kind and text checks preserve the special property-name grammar while excluding computed forms.
// @evidence contracts/common.md#clear-and-simple-design One property-name predicate serves named evaluation without duplicating proto-setter syntax policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The __proto__ spelling is the language's property discriminator, not a fixture or consumer exception.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies accepted name forms, computed exclusion and input premise.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsProtoSetter acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsProtoSetter performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsProtoSetter computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsProtoSetter computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsProtoSetter(node *Node) bool {
  return innerast.IsProtoSetter(node)
}

// NewNodeVisitor creates a visitor with the supplied callback and child hooks.
// A nil factory selects the upstream default factory. The callback may be nil;
// construction itself neither traverses nodes nor invokes visit.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves callback/factory/hooks and upstream nil-factory default rather than starting a traversal.
// @evidence contracts/common.md#clear-and-simple-design One adapter leaves visitation and node recreation with the upstream visitor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported hooks and callback arguments replace no foreign visitor methods.
// @evidence contracts/common.md#meaningful-documentation Native prose explains construction versus traversal and nil inputs with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewNodeVisitor acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewNodeVisitor performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewNodeVisitor computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewNodeVisitor computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func NewNodeVisitor(visit func(node *Node) *Node, factory *NodeFactory, options NodeVisitorHooks) *NodeVisitor {
  return innerast.NewNodeVisitor(visit, factory, options)
}

// GetCombinedModifierFlags returns syntactic modifiers combined across wrappers
// such as variable statements and their declaration lists.
// The node must satisfy the upstream helper's nonnil node precondition.
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream modifier aggregation across declaration wrappers for a nonnil node.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns flag traversal; the shim adds no independent modifier policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed modifier bits or caller-specific aggregation exception is added.
// @evidence contracts/common.md#meaningful-documentation Native prose explains aggregation contexts and nonnil input, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetCombinedModifierFlags acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim selects no independent traversal strategy. Upstream walks H enclosing binding elements, then combines at most three declaration/list/statement modifier values; the call costs O(H) and creates no traversal collection.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding call coordinates no cache or in-flight work; compiler-tree owners determine when node flags and parent links may be reused.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetCombinedModifierFlags computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetCombinedModifierFlags(node *Node) ModifierFlags {
  return innerast.GetCombinedModifierFlags(node)
}

// GetExpressionPrecedence returns the operator precedence of an expression
// node: the level at which it binds relative to a surrounding expression.
// Callers compare it against an OperatorPrecedence floor to decide whether a
// textual splice of the expression into a new position needs parentheses.
// Supply a nonnil expression with a valid upstream kind/payload combination.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream operator and optional-chain/new-expression precedence rules for valid expression data.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns the precedence calculation instead of a second shim ranking table.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed precedence constants or fixture-specific parenthesis outcomes are substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose explains binding-level use and input validity, with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetExpressionPrecedence acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim selects no independent precedence algorithm. Upstream reads kind/operator/optional-chain flags and uses fixed switch tables without traversing expression children; valid node payloads cost O(1) time and space.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding call owns no cache or in-flight coordination; compiler-tree owners establish whether a node's operator and flags remain equivalent across calls.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetExpressionPrecedence computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetExpressionPrecedence(expression *Expression) OperatorPrecedence {
  return innerast.GetExpressionPrecedence(expression)
}

// IsFunctionLike reports whether node is any function-like construct
// (function declaration, arrow function, method, constructor, accessor, etc.).
// A nil node returns false, matching the upstream predicate.
//
// @evidence contracts/common.md#principled-implementation Direct delegation retains upstream function-like kind classification and nil-false behavior.
// @evidence contracts/common.md#clear-and-simple-design One predicate adapter leaves the kind set with its upstream owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer names or test function shapes affect classification.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies function-like forms and nil behavior with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsFunctionLike acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent function-like classifier. Upstream checks nil and fixed declaration/signature kind tables in O(1) time and space without inspecting bodies or parameters.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; tree owners control changes to the compared kind.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsFunctionLike computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsFunctionLike(node *Node) bool {
  return innerast.IsFunctionLike(node)
}

// IsPropertyAssignment reports whether node is a key:value pair inside an
// object literal expression.
// The node must be nonnil; the predicate classifies kind without checking placement.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream property-assignment kind classification without adding placement validation.
// @evidence contracts/common.md#clear-and-simple-design The upstream predicate owns the syntax category; the shim only exposes it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No particular property keys or fixture objects receive special classification.
// @evidence contracts/common.md#meaningful-documentation Native prose explains property-assignment context and nonnil/kind-only limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsPropertyAssignment acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsPropertyAssignment performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsPropertyAssignment computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsPropertyAssignment computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsPropertyAssignment(node *Node) bool {
  return innerast.IsPropertyAssignment(node)
}

// IsPropertyDeclaration reports whether node is a class property declaration.
// Supply a nonnil node; only its kind is classified, not declaration legality.
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream property-declaration kind classification on nonnil nodes.
// @evidence contracts/common.md#clear-and-simple-design The original predicate owns classification without another shim declaration policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer field names or runtime property overrides affect the result.
// @evidence contracts/common.md#meaningful-documentation The comment identifies class-field meaning and unchecked legality with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsPropertyDeclaration acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsPropertyDeclaration performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsPropertyDeclaration computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsPropertyDeclaration computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsPropertyDeclaration(node *Node) bool {
  return innerast.IsPropertyDeclaration(node)
}

// IsModuleBlock reports whether node is the body block of a namespace or
// module declaration.
// Supply a nonnil node; the upstream predicate checks its kind, not parent context.
//
// @evidence contracts/common.md#principled-implementation Delegation retains upstream ModuleBlock kind classification without inferring module ownership.
// @evidence contracts/common.md#clear-and-simple-design One adapter exposes the compiler predicate without a parallel module classifier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No module names or consumer-specific namespaces are special-cased.
// @evidence contracts/common.md#meaningful-documentation Native prose explains module-body purpose and kind/parent validation limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsModuleBlock acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent module-block classifier. Upstream compares one node kind in O(1) time and space without inspecting parent or body statements.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; tree owners control changes to the compared kind.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsModuleBlock computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsModuleBlock(node *Node) bool {
  return innerast.IsModuleBlock(node)
}

// IsStringLiteral reports whether node is a string literal token.
// Supply a nonnil node; no string content is parsed or validated here.
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream string-literal kind classification on a nonnil node.
// @evidence contracts/common.md#clear-and-simple-design The shim exposes the original predicate without another lexical parser.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known string values or fixture spellings affect classification.
// @evidence contracts/common.md#meaningful-documentation The comment distinguishes kind classification from content parsing and explains nonnil input.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsStringLiteral acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsStringLiteral performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsStringLiteral computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsStringLiteral computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsStringLiteral(node *Node) bool {
  return innerast.IsStringLiteral(node)
}

// IsPropertyAccessExpression reports whether node is a dotted member access
// (e.g. `a.b`).
// Supply a nonnil node; binding and operand validity are not checked.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream property-access kind classification without resolving a member binding.
// @evidence contracts/common.md#clear-and-simple-design Classification remains with the compiler predicate instead of a shim expression walker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No particular receiver or property names affect classification.
// @evidence contracts/common.md#meaningful-documentation Native prose gives dotted-access meaning and nonnil/semantic limits with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsPropertyAccessExpression acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsPropertyAccessExpression performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsPropertyAccessExpression computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsPropertyAccessExpression computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsPropertyAccessExpression(node *Node) bool {
  return innerast.IsPropertyAccessExpression(node)
}

// IsElementAccessExpression reports whether node is a bracket member access
// (e.g. `a[b]`).
// Supply a nonnil node; indexing semantics are not evaluated.
//
// @evidence contracts/common.md#principled-implementation Direct delegation preserves upstream element-access kind classification without evaluating index values.
// @evidence contracts/common.md#clear-and-simple-design One adapter exposes upstream classification without another indexing policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture indexes or consumer receiver types affect the predicate.
// @evidence contracts/common.md#meaningful-documentation Native prose illustrates bracket access and explains input/evaluation boundaries.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsElementAccessExpression acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent access classifier. Upstream compares one node kind in O(1) time and space without examining receiver or index children.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; tree owners control changes to the compared kind.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsElementAccessExpression computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsElementAccessExpression(node *Node) bool {
  return innerast.IsElementAccessExpression(node)
}

// IsTokenKind reports whether kind represents a lexical syntax token.
// It classifies an upstream Kind code without inspecting any node payload.
//
// @evidence contracts/common.md#principled-implementation Delegation retains the upstream token-kind range definition rather than inferring it from payloads.
// @evidence contracts/common.md#clear-and-simple-design The upstream predicate owns token classification without a copied shim enum range.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed numeric boundaries or fixture token codes are added.
// @evidence contracts/common.md#meaningful-documentation The comment distinguishes kind classification from node inspection with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsTokenKind acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsTokenKind performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsTokenKind computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsTokenKind computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsTokenKind(kind Kind) bool {
  return innerast.IsTokenKind(kind)
}

// IsExpressionNode reports whether node has expression semantics in its
// enclosing syntax context.
// Supply valid compiler node payloads and the parent links required by
// context-sensitive cases. Parent ascent must terminate; this helper does not
// detect cycles, and context checks can recurse up that chain.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream kind/context expression rules, assuming the required parent relationships exist.
// @evidence contracts/common.md#clear-and-simple-design Upstream owns context-sensitive expression classification without a shim parent walker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer node names or patched syntax parents determine the result.
// @evidence contracts/common.md#meaningful-documentation Native prose describes contextual expression meaning and parent/nonnil premises.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsExpressionNode acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent expression-context algorithm. Upstream uses fixed kind/payload tests, but qualified-name ascent and mutually recursive expression-context fallback can visit H parents, costing O(H) time and up to O(H) call-stack space; it does not scan child subtrees.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding classification owns no cache or in-flight coordination; compiler-tree owners establish validity of context and parent links across calls.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsExpressionNode computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsExpressionNode(node *Node) bool {
  return innerast.IsExpressionNode(node)
}

// IsTypeDeclaration reports whether node declares a type-level symbol.
// Supply a nonnil node; import/export cases require their upstream parent chain.
// This is syntactic classification rather than binding a checker symbol.
//
// @evidence contracts/common.md#principled-implementation Direct delegation retains upstream declaration kinds and parent-based type-only import/export classification.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns type-declaration classification without a shim symbol resolver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No declaration names or consumer type whitelists are substituted.
// @evidence contracts/common.md#meaningful-documentation Native prose states syntactic purpose and parent/nonnil preconditions with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsTypeDeclaration acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsTypeDeclaration performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsTypeDeclaration computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsTypeDeclaration computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsTypeDeclaration(node *Node) bool {
  return innerast.IsTypeDeclaration(node)
}

// IsTypeDeclarationName reports whether node is the name of a type-level
// declaration.
// Supply a nonnil node with the parent relationships needed to inspect its declaration.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream identifier, declaring-parent and name-identity checks for a linked node.
// @evidence contracts/common.md#clear-and-simple-design Name ownership stays in the upstream predicate instead of a shim binding index.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No identifier spellings or fixture declaration names are hardcoded.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies declaration-name meaning and linked-parent input requirements.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsTypeDeclarationName acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsTypeDeclarationName performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsTypeDeclarationName computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsTypeDeclarationName computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsTypeDeclarationName(node *Node) bool {
  return innerast.IsTypeDeclarationName(node)
}

// IsBindingElement reports whether node is one element of a binding pattern.
// Supply a nonnil node; the kind check does not validate its parent pattern.
//
// @evidence contracts/common.md#principled-implementation Direct delegation retains upstream binding-element kind classification without parent validation.
// @evidence contracts/common.md#clear-and-simple-design One adapter exposes the compiler predicate without another binding-pattern walker.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No binding names or fixture destructuring forms affect the result.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies binding-element purpose and nonnil/parent limits.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsBindingElement acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent binding classifier. Upstream compares one node kind in O(1) time and space without traversing parents or children.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; node owners control changes to the compared kind.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsBindingElement computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsBindingElement(node *Node) bool {
  return innerast.IsBindingElement(node)
}

// IsDeclaration reports whether node is a declaration syntax node.
// Supply a nonnil node with valid compiler payload data. Upstream treats a type
// parameter as a declaration only when it has a parent; other kinds use the
// payload's declaration data.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves the upstream parent-sensitive type-parameter case and declaration-payload classification.
// @evidence contracts/common.md#clear-and-simple-design Declaration policy has one upstream owner rather than a copied shim kind set.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The type-parameter distinction is an upstream semantic rule rather than a fixture exception.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the nonobvious parent case and nonnil precondition with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsDeclaration acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent declaration classifier. Upstream checks a type-parameter kind/parent or declaration-data presence in O(1) time and space without traversing the tree.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; compiler-tree owners control parent and payload validity.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsDeclaration computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsDeclaration(node *Node) bool {
  return innerast.IsDeclaration(node)
}

// IsDeclarationNameOrImportPropertyName reports whether node names a
// declaration or the property side of an import or export specifier.
// Supply a nonnil node with a nonnil parent and the required ancestor links.
// Upstream accepts identifier/string-literal specifier names on either alias side.
//
// @evidence contracts/common.md#principled-implementation Direct delegation retains upstream specifier identifier/string-literal and declaring-parent name checks without replacing them with spelling rules.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns alias/name classification; the shim adds no binding resolver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No hardcoded imported names or fixture export mappings are introduced.
// @evidence contracts/common.md#meaningful-documentation Native prose records linked-parent requirements and the upstream both-side specifier behavior.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsDeclarationNameOrImportPropertyName acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent name classifier. Upstream uses fixed parent-kind, identifier/string-kind and declaration/name-identity checks in O(1) time and space without ancestor or name-text scans.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; compiler-tree owners establish validity of parent links and declaration name identity.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsDeclarationNameOrImportPropertyName computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsDeclarationNameOrImportPropertyName(node *Node) bool {
  return innerast.IsDeclarationNameOrImportPropertyName(node)
}

// IsBindingPattern reports whether node is an object or array binding pattern.
// Supply a nonnil node; the kind check does not validate pattern elements.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream object/array binding-pattern kind classification without element checking.
// @evidence contracts/common.md#clear-and-simple-design The upstream predicate owns the two-kind decision without another shim pattern classifier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The object/array alternatives are language syntax rather than fixture-specific pattern names.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies both forms and input/element validation limits with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsBindingPattern acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent pattern classifier. Upstream compares the node kind against two binding kinds in O(1) time and space without inspecting elements.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding predicate owns no cache or in-flight coordination; tree owners control changes to the compared kind.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsBindingPattern computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsBindingPattern(node *Node) bool {
  return innerast.IsBindingPattern(node)
}

// GetSourceFileOfNode walks parent links to return the containing SourceFile.
// A nil input or a chain with no source file returns nil. Parent links must
// form a terminating chain; this operation does not detect cycles.
//
// @evidence contracts/common.md#principled-implementation Directly calling the exported upstream helper preserves source-file identity and nil result for a terminating parent chain without a source owner.
// @evidence contracts/common.md#clear-and-simple-design One normal adapter leaves parent traversal with its upstream owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Exported API delegation needs no linkname binding or guessed AST ancestry.
// @evidence contracts/common.md#meaningful-documentation Native prose explains nil results and terminating-parent responsibility, separating tags from prose.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetSourceFileOfNode acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim selects no independent ancestry-search algorithm. Upstream follows H parent links until a SourceFile or nil, costing O(H) time and O(1) temporary space for a terminating chain.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding query owns no cache or in-flight coordination; compiler-tree owners establish parent-chain validity when reusing an owner result.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetSourceFileOfNode computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetSourceFileOfNode(node *innerast.Node) *innerast.SourceFile {
  return innerast.GetSourceFileOfNode(node)
}

// GetNodeAtPosition descends through non-token AST nodes enclosing position.
// Upstream stops at a meta-property's parent rather than descending into it.
// When includeJSDoc is true the search descends into JSDoc
// sub-trees. Cursor-facing callers that need the exact token should use
// astnav.GetTouchingToken instead. Supply a nonnil file. Position uses the
// source's byte-offset ranges, includes leading trivia and excludes the end
// of a child range; a position outside child ranges returns the file node.
// Lazy JSDoc requires the upstream parser registration and may populate the
// SourceFile's shared JSDoc cache during this search.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream half-open range descent, meta-property parent stop, optional lazy JSDoc search and file-node fallback for a nonnil source file.
// @evidence contracts/common.md#clear-and-simple-design The exported compiler helper owns position traversal instead of a shim range-search engine.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No linkname binding, consumer cursor exception or patched range traversal is needed.
// @evidence contracts/common.md#meaningful-documentation Native prose explains non-token results, byte-offset/end rules, fallback and nonnil input with separated tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The shim controls no independent lifetime. Upstream lazy parsing can allocate nodes and retain them in the supplied SourceFile's cache; its tree owner controls that retained population and lifetime.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent position-search algorithm. Upstream descends one containing branch and scans candidate children and JSDoc at each level, so traversal costs the visited candidates, plus any lazy parse work; no whole-tree position index is maintained here.
// @evidence contracts/performance.md#reuse-equivalent-work When JSDoc is lazy, the supplied SourceFile shares parsed results keyed by node, with read-lock lookup and write-lock recheck before parsing. Repeated queries reuse that tree-owned cache; validity follows the supplied compiler tree, not position equality alone.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetNodeAtPosition computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetNodeAtPosition(file *innerast.SourceFile, position int, includeJSDoc bool) *innerast.Node {
  return innerast.GetNodeAtPosition(file, position, includeJSDoc)
}
