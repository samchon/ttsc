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
//  1. Build a rooted exposed owner with consumer and producer methods.
//  2. Remove the producer and confirm the method parameter becomes a generic gap.
//  3. Confirm an alias and canonical producer close the same object edge.
//  4. Remove the receiver root and confirm its result no longer counts.
//  5. Restore it explicitly, then prove a rootless self-cycle still fails.
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
  complete.add(flowProduce, flowType{pkg: "fixture", name: "Owner"}, "fixture.NewOwner")
  addExposedMethodFlow(completeReachable, completeInner, &complete)
  if findings := evaluateProducerSurface(canonicalizeProducerSurface(complete, completeInner), nil).gaps; len(findings) != 0 {
    t.Fatalf("complete method surface findings = %+v", findings)
  }

  missingReachable, missingInner := build(false)
  missing := newProducerSurface()
  missing.add(flowProduce, flowType{pkg: "fixture", name: "Owner"}, "fixture.NewOwner")
  addExposedMethodFlow(missingReachable, missingInner, &missing)
  canonicalMissing := canonicalizeProducerSurface(missing, missingInner)
  findings := evaluateProducerSurface(canonicalMissing, nil).gaps
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
  if findings := evaluateProducerSurface(canonicalizeProducerSurface(aliases, missingInner), nil).gaps; len(findings) != 0 {
    t.Fatalf("canonical alias surface findings = %+v", findings)
  }

  rootless := newProducerSurface()
  token := flowType{pkg: "fixture", name: "Token"}
  owner := flowType{pkg: "fixture", name: "Owner"}
  rootless.add(flowConsume, token, "fixture.UseToken")
  rootless.methods = append(rootless.methods, methodFlow{
    receiver: owner,
    consumed: map[flowType]map[string]bool{},
    produced: map[flowType]map[string]bool{token: {"fixture.Owner.Produce": true}},
  })
  if findings := evaluateProducerSurface(rootless, nil).gaps; len(findings) != 1 || findings[0].symbol != "Token" {
    t.Fatalf("rootless receiver findings = %+v, want fixture.Token", findings)
  }
  rooted := evaluateProducerSurface(rootless, map[string]string{"fixture.Owner": "Caller-owned root."})
  if len(rooted.gaps) != 0 || !rooted.usedRoots["fixture.Owner"] {
    t.Fatalf("rooted receiver evaluation = %+v, want no gaps and used Owner root", rooted)
  }

  cycle := newProducerSurface()
  cycle.add(flowConsume, owner, "fixture.UseOwner")
  cycle.methods = append(cycle.methods, methodFlow{
    receiver: owner,
    consumed: map[flowType]map[string]bool{},
    produced: map[flowType]map[string]bool{owner: {"fixture.Owner.Clone": true}},
  })
  if findings := evaluateProducerSurface(cycle, nil).gaps; len(findings) != 1 || findings[0].symbol != "Owner" {
    t.Fatalf("rootless self-cycle findings = %+v, want fixture.Owner", findings)
  }
}
