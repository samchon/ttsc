// Package graph builds a checker-resolved code reference graph over a tsgo
// Program: modeled symbols and checker-derived relationships. Separate artifact
// links can also be added; not every edge is a compiler binding or a runtime-use
// observation.
//
// resolve.go holds the load-bearing primitive the rest of the graph depends on:
// following a reference to the true declaration the checker binds it to. The
// hard case is the barrel re-export, where `pkg/index.ts` re-exports a sibling's
// symbol; that shape carries almost every cross-package edge in a monorepo.
// Stopping at GetSymbolAtLocation lands on the local import alias and severs the
// edge at the index file, which collapses the output back to tree-sitter
// quality. Unwrapping the alias chain (Checker_getAliasedSymbol) lands on the
// sibling source that actually declares the symbol. Resolve does that unwrap,
// then classifies where the declaration lives so a node_modules / `.d.ts`
// boundary becomes an external leaf instead of pulling a dependency's internals
// into the graph.
package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// Target is the contextual endpoint reported by Resolve: a checker symbol,
// representative source declaration when available, and lexical external
// classification (a node_modules or `.d.ts` boundary leaf).
// A bound symbol without a representative source declaration retains empty File
// and zero location/default External; those defaults do not prove workspace ownership.
//
// @evidence contracts/common.md#principled-implementation A bound symbol and its representative declaration location distinguish authored endpoints from external boundary leaves.
// @evidence contracts/common.md#clear-and-simple-design One resolution record passes checker identity and byte span to edge creation without reparsing the reference.
// @evidence contracts/common.md#prohibited-implementation-shortcuts External classification follows declaration ownership, not a consumer-name heuristic.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies symbol binding and the node_modules/declaration-file boundary; tags remain separated under the documentation skill.
// @evidenceExclude contracts/performance.md#efficient-algorithms The record chooses no resolution strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Build's resolver memo owns reuse, not this value container.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The record borrows a compiler symbol without independently acquiring a generation lease. Caller-held targets can keep symbol/declaration references reachable after build scratch is dropped.
// @evidence contracts/portability.md#os-neutral-implementation File is compiler-reported spelling and External is declaration-file/node_modules lexical classification; neither certifies physical realpath or ownership under aliases.
type Target struct {
  Symbol   *shimast.Symbol
  File     string
  External bool
  Pos      int
  End      int
}

// resolve is Resolve with the graph's memo in front of it.
//
// The edge pass walks the same AST more than once by construction: `collectCalls`
// and `collectTypeRefs` each descend the whole container tree, and a closure's
// body is walked again for every container that encloses it. Every one of those
// visits asked the checker again, and for an identifier that is not a cheap
// lookup — typescript-go caches a resolved property access on the node, but a
// plain identifier goes back through `resolveEntityName` and a full scope walk
// each time.
//
// A node's resolution cannot change while the program is fixed, which it is for
// the length of a build, so the second answer is always the first one.
func (g *Graph) resolve(checker *shimchecker.Checker, ref *shimast.Node) *Target {
  if ref == nil {
    return nil
  }
  if cached, hit := g.resolved[ref]; hit {
    return cached
  }
  target := Resolve(checker, ref)
  g.resolved[ref] = target
  return target
}

// Resolve uses the checker's external GetSymbolAtLocation API, then requests an
// aliased symbol when one is reported. That API deliberately returns a contextual
// symbol, not a universal type-checking binding guarantee. A valid checker and
// parented source-tree ref are required. Nil means no reported symbol; a symbol
// without a source declaration can instead return a target with empty File.
//
// @evidence contracts/common.md#principled-implementation The supported external symbol API and alias API supply a contextual endpoint; representative declaration selection prefers non-declaration-file bodies without certifying physical ownership or every expression's type-checking binding.
// @evidence contracts/common.md#clear-and-simple-design Symbol lookup, alias unwrapping and declaration classification form one endpoint adapter shared by graph relation passes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Barrel resolution uses the supported checker API rather than guessing export files or rewriting foreign state.
// @evidence contracts/common.md#meaningful-documentation Native prose states alias behavior, unresolved outcomes and source ownership, with documentation-skill tag spacing.
// @evidence contracts/performance.md#efficient-algorithms Delegated contextual lookup/alias resolution can perform lazy semantic work beyond the returned symbol. Up to three declaration passes, source ancestry and filename classification add declaration-count/depth/string costs; this adapter itself performs no repository scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Direct Resolve owns no repeated-request cache; Graph.resolve supplies build-local AST-keyed reuse for graph passes.
// @evidence contracts/performance.md#bound-retention-and-release-resources The new endpoint and borrowed symbol transfer to the caller and can retain declarations/AST state. The compiler owner must keep that generation stable; this adapter owns no historical cache, generation lease or native handle release.
// @evidence contracts/portability.md#os-neutral-implementation Returned filename spelling and declaration-file/node_modules classification come from the supplied compiler tree. Lexical classification does not resolve native aliases or establish physical workspace ownership.
func Resolve(checker *shimchecker.Checker, ref *shimast.Node) *Target {
  symbol := checker.GetSymbolAtLocation(ref)
  if symbol == nil {
    return nil
  }
  if symbol.Flags&shimast.SymbolFlagsAlias != 0 {
    if aliased := shimchecker.Checker_getAliasedSymbol(checker, symbol); aliased != nil {
      symbol = aliased
    }
  }
  target := &Target{Symbol: symbol}
  if declaration := declarationNode(symbol); declaration != nil {
    target.Pos = declaration.Pos()
    target.End = declaration.End()
    if file := shimast.GetSourceFileOfNode(declaration); file != nil {
      target.File = file.FileName()
      target.External = !IsWorkspaceSourceFile(file)
    }
  }
  return target
}

// declarationFile returns the source file of symbol's first declaration, or nil
// when the symbol carries no declaration (an intrinsic or synthesized symbol).
// The checker resolves symlinks to realpath because preserveSymlinks defaults to
// false, so a pnpm `workspace:*` sibling resolves to its real source here and is
// not misclassified as external by Resolve.
func declarationFile(symbol *shimast.Symbol) *shimast.SourceFile {
  if declaration := declarationNode(symbol); declaration != nil {
    return shimast.GetSourceFileOfNode(declaration)
  }
  return nil
}

func declarationNode(symbol *shimast.Symbol) *shimast.Node {
  if len(symbol.Declarations) == 0 {
    return nil
  }
  // Prefer a non-declaration-file declaration. A declaration-merged symbol (a
  // class paired with an interface, or a function with a namespace) can list a
  // `.d.ts` declaration first; classifying by it would mark a real workspace
  // symbol external and sever it from the graph.
  for _, declaration := range symbol.Declarations {
    if file := shimast.GetSourceFileOfNode(declaration); file != nil && !file.IsDeclarationFile && declaration.Body() != nil {
      return declaration
    }
  }
  for _, declaration := range symbol.Declarations {
    if file := shimast.GetSourceFileOfNode(declaration); file != nil && !file.IsDeclarationFile {
      return declaration
    }
  }
  for _, declaration := range symbol.Declarations {
    if declaration.Body() != nil {
      return declaration
    }
  }
  return symbol.Declarations[0]
}
