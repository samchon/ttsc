package main

import (
  "go/token"
  "go/types"
  "testing"

  "golang.org/x/tools/go/packages"
)

// Verifies producer closure includes exported methods and canonical type aliases.
//
// Shim aliases publish upstream method sets without source declarations, while
// aliases such as Expression and Node can spell the same compiler object twice.
//
//  1. Build a synthetic exposed owner with consumer and producer methods.
//  2. Remove the producer and confirm the method parameter becomes a generic gap.
//  3. Confirm an alias consumer and canonical producer close the same object edge.
func TestProducerSurfaceIncludesExposedMethods(t *testing.T) {
  build := func(includeProducer bool) (reachable, map[string]*packages.Package) {
    pkg := types.NewPackage(internalPrefix+"fixture", "fixture")
    tokenName := types.NewTypeName(token.NoPos, pkg, "Token", nil)
    tokenType := types.NewNamed(tokenName, types.NewStruct(nil, nil), nil)
    pkg.Scope().Insert(tokenName)
    ownerName := types.NewTypeName(token.NoPos, pkg, "Owner", nil)
    ownerType := types.NewNamed(ownerName, types.NewStruct(nil, nil), nil)
    pkg.Scope().Insert(ownerName)
    receiver := types.NewVar(token.NoPos, pkg, "owner", types.NewPointer(ownerType))
    consume := types.NewSignatureType(
      receiver,
      nil,
      nil,
      types.NewTuple(types.NewVar(token.NoPos, pkg, "value", types.NewPointer(tokenType))),
      types.NewTuple(),
      false,
    )
    ownerType.AddMethod(types.NewFunc(token.NoPos, pkg, "Consume", consume))
    if includeProducer {
      produce := types.NewSignatureType(
        receiver,
        nil,
        nil,
        types.NewTuple(),
        types.NewTuple(types.NewVar(token.NoPos, pkg, "value", types.NewPointer(tokenType))),
        false,
      )
      ownerType.AddMethod(types.NewFunc(token.NoPos, pkg, "Produce", produce))
    }
    exposed := reachable{}
    exposed.add("fixture", "Owner")
    return exposed, map[string]*packages.Package{"fixture": {Types: pkg}}
  }

  completeReachable, completeInner := build(true)
  complete := newProducerSurface()
  addExposedMethodFlow(completeReachable, completeInner, complete)
  if findings := producerFindings(canonicalizeProducerSurface(complete, completeInner)); len(findings) != 0 {
    t.Fatalf("complete method surface findings = %+v", findings)
  }

  missingReachable, missingInner := build(false)
  missing := newProducerSurface()
  addExposedMethodFlow(missingReachable, missingInner, missing)
  findings := producerFindings(canonicalizeProducerSurface(missing, missingInner))
  if len(findings) != 1 || findings[0].pkg != "fixture" || findings[0].symbol != "Token" {
    t.Fatalf("missing method producer findings = %+v, want fixture.Token", findings)
  }

  aliasPkg := missingInner["fixture"].Types
  aliasName := types.NewTypeName(token.NoPos, aliasPkg, "TokenAlias", nil)
  types.NewAlias(aliasName, aliasPkg.Scope().Lookup("Token").Type())
  aliasPkg.Scope().Insert(aliasName)
  aliases := newProducerSurface()
  aliases.add(flowConsume, flowType{pkg: "fixture", name: "TokenAlias"}, "fixture.ConsumeAlias")
  aliases.add(flowProduce, flowType{pkg: "fixture", name: "Token"}, "fixture.ProduceToken")
  if findings := producerFindings(canonicalizeProducerSurface(aliases, missingInner)); len(findings) != 0 {
    t.Fatalf("canonical alias surface findings = %+v", findings)
  }
}
