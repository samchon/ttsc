package main

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// firstNodeOfKind walks the source file in source order and returns the
// first node whose Kind matches `kind`. Test fixtures rely on this to
// reach interior nodes (object literals, call expressions, etc.) without
// duplicating the visitor boilerplate per test file.
func firstNodeOfKind(t *testing.T, file *shimast.SourceFile, kind shimast.Kind) *shimast.Node {
  t.Helper()
  if file == nil {
    t.Fatal("firstNodeOfKind: source file is nil")
  }
  var found *shimast.Node
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil || found != nil {
      return
    }
    if node.Kind == kind {
      found = node
      return
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return found != nil
    })
  }
  // SourceFile.Statements drives the user-visible tree.
  if stmts := file.Statements; stmts != nil {
    for _, stmt := range stmts.Nodes {
      walk(stmt)
      if found != nil {
        break
      }
    }
  }
  if found == nil {
    t.Fatalf("firstNodeOfKind: no node of kind %d found", kind)
  }
  return found
}

// nthNodeOfKind returns the `index`-th occurrence (0-based) of the
// requested kind. Used by tests that need to isolate, say, the second
// CallExpression in a fixture.
func nthNodeOfKind(t *testing.T, file *shimast.SourceFile, kind shimast.Kind, index int) *shimast.Node {
  t.Helper()
  if file == nil {
    t.Fatal("nthNodeOfKind: source file is nil")
  }
  seen := 0
  var found *shimast.Node
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil || found != nil {
      return
    }
    if node.Kind == kind {
      if seen == index {
        found = node
        return
      }
      seen++
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return found != nil
    })
  }
  if stmts := file.Statements; stmts != nil {
    for _, stmt := range stmts.Nodes {
      walk(stmt)
      if found != nil {
        break
      }
    }
  }
  if found == nil {
    t.Fatalf("nthNodeOfKind: kind %d index %d not found", kind, index)
  }
  return found
}
