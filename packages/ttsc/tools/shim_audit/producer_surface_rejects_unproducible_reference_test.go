package main

import (
  "go/token"
  "go/types"
  "strings"
  "testing"

  "golang.org/x/tools/go/packages"
)

// Verifies producer closure rejects a consumed reference after its only producer is removed.
//
// The regression is type-flow specific: callback inputs are producers, callback
// results are consumers, named contracts retain that variance, and non-pointer
// values must not enter the object graph.
//
//  1. Scan a generic surface containing returns, callbacks, and a source method.
//  2. Confirm only the intentionally input-only object is initially unreachable.
//  3. Remove a package producer and confirm its generic type-keyed gap appears.
//  4. Remove a method consumer's producer and confirm that gap appears too.
//  5. Repeat through recursive named callbacks and containers without hanging.
//  6. Prove package-operation cycles fail until an independent root is added.
func TestProducerSurfaceRejectsUnproducibleReference(t *testing.T) {
  source := `package fixture
import inner "github.com/microsoft/typescript-go/internal/fixture"
func ConsumeToken(value *inner.Token) {}
func ProduceToken() []*inner.Token { return nil }
func Register(handler func(*inner.Event) *inner.Reply) {}
func ProduceReply() *inner.Reply { return nil }
func RegisterInterface(handler interface { Handle(*inner.Notice) *inner.Ack }) {}
func ProduceAck() *inner.Ack { return nil }
type Owner struct{}
func (*Owner) ConsumeMethod(value *inner.MethodToken) {}
func ProduceMethodToken() *inner.MethodToken { return nil }
func ConsumeOrphan(value *inner.Orphan) {}
func IgnorePointedContainer(value *[]inner.ContainerValue) {}
func IgnoreValue(value inner.Mode) {}
func hidden(value *inner.Hidden) {}
`
  scanWithInner := func(input string, inner map[string]*packages.Package) []finding {
    surface := newProducerSurface()
    definitions, err := scanLocalFlowDefinitions([]byte(input), "fixture.go")
    if err != nil {
      t.Fatal(err)
    }
    if err := scanProducerFile([]byte(input), "fixture.go", "fixture", definitions, inner, &surface); err != nil {
      t.Fatal(err)
    }
    return evaluateProducerSurface(surface, nil).gaps
  }
  scan := func(input string) []finding { return scanWithInner(input, nil) }

  complete := scan(source)
  if len(complete) != 1 || complete[0].symbol != "Orphan" {
    t.Fatalf("complete surface findings = %+v, want only input-only Orphan", complete)
  }

  mutated := scan(strings.Replace(source, "func ProduceToken() []*inner.Token { return nil }\n", "", 1))
  if len(mutated) != 2 || mutated[0].symbol != "Orphan" || mutated[1].symbol != "Token" {
    t.Fatalf("mutated surface findings = %+v, want Orphan and Token", mutated)
  }
  for _, finding := range mutated {
    if finding.kind != "PRODUCER" || strings.Contains(finding.detail, "Signature") {
      t.Fatalf("finding is not generic producer evidence: %+v", finding)
    }
  }

  mutatedMethod := scan(strings.Replace(source, "func ProduceMethodToken() *inner.MethodToken { return nil }\n", "", 1))
  if len(mutatedMethod) != 2 || mutatedMethod[0].symbol != "MethodToken" || mutatedMethod[1].symbol != "Orphan" {
    t.Fatalf("source-method mutation findings = %+v, want MethodToken and Orphan", mutatedMethod)
  }

  namedSource := `package fixture
import inner "github.com/microsoft/typescript-go/internal/fixture"
type Factory func() *inner.FactoryToken
type Batch []*inner.BatchToken
type PointerBatch []*inner.PointerBatchToken
type Recursive func(Recursive)
func RegisterFactory(factory Factory) {}
func ConsumeBatch(batch Batch) {}
func ConsumePointerBatch(batch *PointerBatch) {}
func RegisterRecursive(callback Recursive) {}
func ProduceFactoryToken() *inner.FactoryToken { return nil }
func ProduceBatchToken() *inner.BatchToken { return nil }
func ProducePointerBatchToken() *inner.PointerBatchToken { return nil }
`
  if findings := scan(namedSource); len(findings) != 0 {
    t.Fatalf("named callback/container findings = %+v, want none", findings)
  }
  namedMutated := strings.Replace(namedSource, "func ProduceFactoryToken() *inner.FactoryToken { return nil }\n", "", 1)
  namedMutated = strings.Replace(namedMutated, "func ProduceBatchToken() *inner.BatchToken { return nil }\n", "", 1)
  namedMutated = strings.Replace(namedMutated, "func ProducePointerBatchToken() *inner.PointerBatchToken { return nil }\n", "", 1)
  namedFindings := scan(namedMutated)
  if len(namedFindings) != 3 || namedFindings[0].symbol != "BatchToken" || namedFindings[1].symbol != "FactoryToken" || namedFindings[2].symbol != "PointerBatchToken" {
    t.Fatalf("named callback/container mutation findings = %+v, want BatchToken, FactoryToken, and PointerBatchToken", namedFindings)
  }

  upstream := types.NewPackage(internalPrefix+"fixture", "fixture")
  upstreamTokenName := types.NewTypeName(token.NoPos, upstream, "UpstreamToken", nil)
  upstreamToken := types.NewNamed(upstreamTokenName, types.NewStruct(nil, nil), nil)
  upstream.Scope().Insert(upstreamTokenName)
  upstreamFactoryName := types.NewTypeName(token.NoPos, upstream, "UpstreamFactory", nil)
  types.NewNamed(upstreamFactoryName, types.NewSignatureType(
    nil,
    nil,
    nil,
    types.NewTuple(),
    types.NewTuple(types.NewVar(token.NoPos, upstream, "value", types.NewPointer(upstreamToken))),
    false,
  ), nil)
  upstream.Scope().Insert(upstreamFactoryName)
  upstreamInner := map[string]*packages.Package{"fixture": {Types: upstream}}
  upstreamSource := `package fixture
import inner "github.com/microsoft/typescript-go/internal/fixture"
func RegisterUpstreamFactory(factory inner.UpstreamFactory) {}
func ProduceUpstreamToken() *inner.UpstreamToken { return nil }
`
  if findings := scanWithInner(upstreamSource, upstreamInner); len(findings) != 0 {
    t.Fatalf("upstream named callback findings = %+v, want none", findings)
  }
  upstreamMutated := strings.Replace(upstreamSource, "func ProduceUpstreamToken() *inner.UpstreamToken { return nil }\n", "", 1)
  upstreamFindings := scanWithInner(upstreamMutated, upstreamInner)
  if len(upstreamFindings) != 1 || upstreamFindings[0].symbol != "UpstreamToken" {
    t.Fatalf("upstream named callback mutation findings = %+v, want UpstreamToken", upstreamFindings)
  }

  cycleSource := `package fixture
import inner "github.com/microsoft/typescript-go/internal/fixture"
func AFromB(value *inner.B) *inner.A { return nil }
func BFromA(value *inner.A) *inner.B { return nil }
func UseA(value *inner.A) {}
`
  cycleFindings := scan(cycleSource)
  if len(cycleFindings) != 2 || cycleFindings[0].symbol != "A" || cycleFindings[1].symbol != "B" {
    t.Fatalf("rootless operation cycle findings = %+v, want A and B", cycleFindings)
  }
  rootedChain := strings.Replace(cycleSource, "func UseA(value *inner.A) {}\n", "func NewA() *inner.A { return nil }\nfunc UseA(value *inner.A) {}\n", 1)
  if findings := scan(rootedChain); len(findings) != 0 {
    t.Fatalf("rooted operation chain findings = %+v, want none", findings)
  }
}
