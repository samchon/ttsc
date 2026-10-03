package graph

import (
  "strings"
  "testing"
)

// TestDumpPathMapperRejectsUnportableRootsAndCollisions pins both fail-closed
// boundaries of the mapping contract.
//
//  1. Reject a different Windows drive and a different UNC share precisely.
//  2. Force two physical sources through one coordinate and require a collision.
//  3. Require NewDump to surface the root error before JSON serialization.
//
// @evidence contracts/testing.md#behavioral-verification TestDumpPathMapperRejectsUnportableRootsAndCollisions pins both fail-closed boundaries of the mapping contract.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over synthetic paths: a file on drive D under a project on drive C, and one on a different UNC share, must record an error containing 'different filesystem roots'; two physical sources claimed at one wire path must record an error containing 'collide at wire identity'; and NewDump over a graph with a cross-drive node must return the root error instead of a document.
// @evidence contracts/testing.md#distinguishing-cases Reject a different Windows drive and a different UNC share precisely; Force two physical sources through one coordinate and require a collision; Require NewDump to surface the root error before JSON serialization.
// @evidence contracts/testing.md#execution-ownership TestDumpPathMapperRejectsUnportableRootsAndCollisions is a Go source-unit entry. NewDump, newDumpPathMapper, nodeID execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestDumpPathMapperRejectsUnportableRootsAndCollisions(t *testing.T) {
  for _, test := range []struct {
    name    string
    project string
    file    string
  }{
    {"windows-drive", "C:/checkout/app", "D:/shared/value.ts"},
    {"unc-share", "//server/share-a/app", "//server/share-b/value.ts"},
  } {
    t.Run(test.name, func(t *testing.T) {
      mapper := newDumpPathMapper(test.project)
      mapper.mapPath(test.file)
      if err := mapper.err(); err == nil || !strings.Contains(err.Error(), "different filesystem roots") {
        t.Fatalf("cross-root error = %v, want a precise filesystem-root rejection", err)
      }
    })
  }

  collision := newDumpPathMapper("/checkout/app")
  collision.claim("/physical/one.ts", "shared.ts")
  collision.claim("/physical/two.ts", "shared.ts")
  if err := collision.err(); err == nil || !strings.Contains(err.Error(), "collide at wire identity") {
    t.Fatalf("collision error = %v, want an injectivity rejection", err)
  }

  file := "D:/shared/value.ts"
  id := nodeID(file, "value", NodeVariable)
  _, err := NewDump(&Graph{Nodes: map[string]*Node{
    id: &Node{ID: id, Name: "value", Simple: "value", Kind: NodeVariable, File: file},
  }}, "C:/checkout/app", "tsconfig.json", nil, nil, DumpOrigin{})
  if err == nil || !strings.Contains(err.Error(), "different filesystem roots") {
    t.Fatalf("NewDump cross-root error = %v, want rejection before serialization", err)
  }
}
