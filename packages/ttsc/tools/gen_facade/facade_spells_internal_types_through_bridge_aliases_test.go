package main

import (
  "go/token"
  "go/types"
  "strings"
  "testing"
)

// TestFacadeSpellsInternalTypesThroughBridgeAliases verifies the facade names
// a compiler-internal type only through a bridge alias and degrades exactly
// where Go cannot spell a signature.
//
// Authored go/types packages stand in for one internal package and one bridge,
// so the cases isolate the printer's naming policy from module loading.
//
//  1. Declare internal Node and Hidden types, and a bridge aliasing only Node.
//  2. Give the bridge functions over Node, over Hidden, and a generic over Hidden.
//  3. Render the facade and assert each spelling or the generation failure.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production renderFacade and newAliasIndex and asserts the exact forwarded function, alias, held-variable and failure outputs.
// @evidence contracts/testing.md#independent-expectations Literal facade lines and the unexposed type's name are written from the facade contract, not derived from generator output.
// @evidence contracts/testing.md#distinguishing-cases Covers an aliased internal parameter, an unaliased internal parameter in a non-generic function, and the same type in a generic function, each with a different required result.
// @evidence contracts/testing.md#execution-ownership This tools/gen_facade source unit builds packages in memory in one Go process; it loads no module, writes no file and starts no process.
func TestFacadeSpellsInternalTypesThroughBridgeAliases(t *testing.T) {
  internal := types.NewPackage(internalPrefix+"ast", "ast")
  node := types.NewNamed(types.NewTypeName(token.NoPos, internal, "Node", nil), types.NewStruct(nil, nil), nil)
  internal.Scope().Insert(node.Obj())
  hidden := types.NewNamed(types.NewTypeName(token.NoPos, internal, "Hidden", nil), types.NewStruct(nil, nil), nil)
  internal.Scope().Insert(hidden.Obj())

  newBridge := func(withGeneric bool) bridge {
    pkg := types.NewPackage(bridgePrefix+"ast", "ast")
    alias := types.NewTypeName(token.NoPos, pkg, "Node", nil)
    types.NewAlias(alias, node)
    pkg.Scope().Insert(alias)
    param := func(typ types.Type) *types.Tuple {
      return types.NewTuple(types.NewVar(token.NoPos, pkg, "n", typ))
    }
    insertFunc := func(name string, sig *types.Signature) {
      pkg.Scope().Insert(types.NewFunc(token.NoPos, pkg, name, sig))
    }
    insertFunc("Visit", types.NewSignatureType(nil, nil, nil, param(types.NewPointer(node)), types.NewTuple(types.NewVar(token.NoPos, pkg, "", types.Typ[types.Bool])), false))
    insertFunc("Peek", types.NewSignatureType(nil, nil, nil, param(types.NewPointer(hidden)), nil, false))
    if withGeneric {
      typeParam := types.NewTypeParam(types.NewTypeName(token.NoPos, pkg, "T", nil), types.Universe.Lookup("any").Type())
      insertFunc("Map", types.NewSignatureType(nil, nil, []*types.TypeParam{typeParam}, param(types.NewPointer(hidden)), types.NewTuple(types.NewVar(token.NoPos, pkg, "", typeParam)), false))
    }
    return bridge{rel: "ast", pkg: pkg}
  }

  plain := newBridge(false)
  source, _, err := renderFacade(plain, newAliasIndex([]bridge{plain}))
  if err != nil {
    t.Fatal(err)
  }
  for _, want := range []string{
    `tscast "github.com/microsoft/TypeScript/tsc/shim/ast"`,
    "type Node = tscast.Node",
    "func Visit(p0 *tscast.Node) bool {\n  return tscast.Visit(p0)\n}",
    "// exposes (" + internalPrefix + "ast.Hidden).\nvar Peek = tscast.Peek",
  } {
    if !strings.Contains(string(source), want) {
      t.Errorf("facade lacks %q:\n%s", want, source)
    }
  }
  if strings.Contains(string(source), `"`+internalPrefix) {
    t.Errorf("facade imports the internal package:\n%s", source)
  }

  generic := newBridge(true)
  _, _, err = renderFacade(generic, newAliasIndex([]bridge{generic}))
  if err == nil || !strings.Contains(err.Error(), bridgePrefix+"ast.Map: cannot name "+internalPrefix+"ast.Hidden") {
    t.Fatalf("generic function over an unexposed type: got %v", err)
  }
}
