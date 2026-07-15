package main

import (
  "strings"
  "testing"
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
  scan := func(input string) []finding {
    surface := newProducerSurface()
    definitions, err := scanLocalFlowDefinitions([]byte(input), "fixture.go")
    if err != nil {
      t.Fatal(err)
    }
    if err := scanProducerFile([]byte(input), "fixture.go", "fixture", definitions, nil, surface); err != nil {
      t.Fatal(err)
    }
    return evaluateProducerSurface(surface, nil).gaps
  }

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
type Recursive func(Recursive)
func RegisterFactory(factory Factory) {}
func ConsumeBatch(batch Batch) {}
func RegisterRecursive(callback Recursive) {}
func ProduceFactoryToken() *inner.FactoryToken { return nil }
func ProduceBatchToken() *inner.BatchToken { return nil }
`
  if findings := scan(namedSource); len(findings) != 0 {
    t.Fatalf("named callback/container findings = %+v, want none", findings)
  }
  namedMutated := strings.Replace(namedSource, "func ProduceFactoryToken() *inner.FactoryToken { return nil }\n", "", 1)
  namedMutated = strings.Replace(namedMutated, "func ProduceBatchToken() *inner.BatchToken { return nil }\n", "", 1)
  namedFindings := scan(namedMutated)
  if len(namedFindings) != 2 || namedFindings[0].symbol != "BatchToken" || namedFindings[1].symbol != "FactoryToken" {
    t.Fatalf("named callback/container mutation findings = %+v, want BatchToken and FactoryToken", namedFindings)
  }
}
