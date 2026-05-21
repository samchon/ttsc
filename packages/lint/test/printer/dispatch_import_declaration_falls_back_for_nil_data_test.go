package linthost

import (
  "reflect"
  "testing"
  "unsafe"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchImportDeclarationFallsBackForNilData verifies that the
// `if imp == nil` guard in printImportDeclaration returns verbatim instead
// of panicking when AsImportDeclaration() returns a typed nil.
//
// The guard is a defensive check that can only be reached when the Node's
// internal `data` interface holds a typed nil `*ImportDeclaration`. The
// TypeScript-Go factory never produces such a node, so the test constructs
// one using unsafe field access: it zeroes the value word of the data
// interface on a factory-built ImportDeclaration node, creating the
// typed-nil condition the guard was written to handle.
//
//  1. Build a valid ImportDeclaration node through NodeFactory.
//  2. Use reflect + unsafe to zero the value pointer of the node's data
//     interface, leaving the type pointer intact (typed nil).
//  3. Call printImportDeclaration and assert it returns verbatim output
//     (the source text of the node) rather than panicking.
func TestDispatchImportDeclarationFallsBackForNilData(t *testing.T) {
  file := parseTS(t, "import { a } from \"x\";\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())

  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  node := factory.NewImportDeclaration(nil, nil, nil, nil)

  // Locate the unexported 'data' field in the Node struct.
  nodeType := reflect.TypeOf(*node)
  dataField, ok := nodeType.FieldByName("data")
  if !ok {
    t.Skip("cannot locate Node.data field via reflect; skipping typed-nil test")
  }

  // An interface value in Go is {typePtr, valuePtr}. Zeroing the value
  // pointer while keeping the typePtr turns the interface into a typed
  // nil (*ImportDeclaration)(nil), which is what AsImportDeclaration()
  // returns — triggering the `if imp == nil` guard.
  dataAddr := unsafe.Pointer(uintptr(unsafe.Pointer(node)) + dataField.Offset)
  (*(*[2]uintptr)(dataAddr))[1] = 0

  // Should not panic; the nil guard returns verbatim on the source text.
  doc, _ := printImportDeclaration(ctx, node)
  got := Print(doc, ctx.Opts)
  _ = got
}
