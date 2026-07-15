package main

import (
  "strings"
  "testing"
)

// Verifies producer closure rejects a consumed reference after its only producer is removed.
//
// The regression is type-flow specific: callback inputs are producers, callback
// results are consumers, and non-pointer values must not enter the object graph.
//
//  1. Scan a generic surface containing a return, an input-only object, and a callback.
//  2. Confirm only the intentionally input-only object is initially unreachable.
//  3. Remove the ordinary producer and confirm the generic type-keyed gap appears.
func TestProducerSurfaceRejectsUnproducibleReference(t *testing.T) {
  source := `package fixture
import inner "github.com/microsoft/typescript-go/internal/fixture"
func ConsumeToken(value *inner.Token) {}
func ProduceToken() []*inner.Token { return nil }
func Register(handler func(*inner.Event) *inner.Reply) {}
func ProduceReply() *inner.Reply { return nil }
func RegisterInterface(handler interface { Handle(*inner.Notice) *inner.Ack }) {}
func ProduceAck() *inner.Ack { return nil }
func ConsumeOrphan(value *inner.Orphan) {}
func IgnorePointedContainer(value *[]inner.ContainerValue) {}
func IgnoreValue(value inner.Mode) {}
func hidden(value *inner.Hidden) {}
`
  scan := func(input string) []finding {
    surface := newProducerSurface()
    if err := scanProducerFile([]byte(input), "fixture.go", "fixture", nil, surface); err != nil {
      t.Fatal(err)
    }
    return producerFindings(surface)
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
}
