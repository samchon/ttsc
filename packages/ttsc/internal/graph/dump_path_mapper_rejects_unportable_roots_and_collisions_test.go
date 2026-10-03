package graph

import (
  "strings"
  "testing"
)

// TestDumpPathMapperRejectsUnportableRootsAndCollisions checks two supplied
// cross-root paths, a directly injected wire-claim collision, and NewDump's
// cross-drive error. It does not traverse native source aliases or serialize.
//
//  1. Reject a different Windows drive and a different UNC share precisely.
//  2. Force two physical sources through one coordinate and require a collision.
//  3. Require NewDump to surface the root error before JSON serialization.
//
// @evidence contracts/testing.md#behavioral-verification Actual mapPath must latch different-root errors for the authored drive and UNC-share pairs; direct claim calls must latch a collision for two distinct supplied physical keys at shared.ts. NewDump must return a cross-drive error. Its returned Dump and serialized bytes are not examined.
// @evidence contracts/testing.md#independent-expectations Literal path pairs require different filesystem roots message fragments, distinct physical claim keys at one shared.ts require collide at wire identity, and the authored cross-drive node requires NewDump's root error. Physical key strings are injected test facts, not native SameFile authentication.
// @evidence contracts/testing.md#distinguishing-cases Different Windows drives and different UNC shares exercise separate root grammar; directly conflicting claims exercise injectivity; a graph node exercises dump-level error propagation. TestDumpPathMapperCachesAliasResolution owns the successful repeated same-root coordinate counterpart, not native alias completeness.
// @evidence contracts/testing.md#execution-ownership This same-package Go unit directly constructs mappers, supplies instance-owned claim facts and a test-owned Graph, and calls mapPath and NewDump. Host-compatible authored absolute paths can trigger best-effort native canonicalization and ancestor reads. No compiler Program, consumer installation, product command or JSON serialization runs.
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
