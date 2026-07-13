// Package graph builds a checker-resolved code reference graph over a tsgo
// Program: symbols as nodes, type-resolved relationships as edges. Because the
// graph rides ttsc's in-process Checker, every edge is resolved by the real
// type checker rather than a syntactic heuristic, so an edge can be tagged
// "checker-resolved" instead of "guessed".
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
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// Target is the resolved endpoint of a reference: the declaration symbol the
// checker binds it to, the source file that declares it, and whether that file
// sits outside the workspace (a node_modules or `.d.ts` boundary leaf).
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

// Resolve follows ref to the real declaration the checker binds it to. It
// unwraps import/export alias chains so a reference through a barrel re-export
// lands on the sibling source that declares the symbol, not the re-exporting
// index file. It returns nil when the checker cannot bind ref to a symbol (a
// numeric literal, a punctuation token, an unresolved name).
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
      target.External = file.IsDeclarationFile ||
        strings.Contains(target.File, "/node_modules/")
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
