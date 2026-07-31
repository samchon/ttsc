package graph

import "testing"

// TestWireNodeIDsShareAliasResolution verifies the public resident shard
// helper keeps declarations from one physical source distinct and stable.
//
// External declarations commonly share a package source file. Mapping the IDs
// as one batch must preserve the shared source coordinate without collisions.
//
//  1. Build two declaration IDs owned by one physical dependency source.
//  2. Map both IDs through the public batch helper.
//  3. Require distinct IDs with the same portable source coordinate.
func TestWireNodeIDsShareAliasResolution(t *testing.T) {
  source := "C:/checkout/app/node_modules/pkg/index.d.ts"
  first := nodeID(source, "First", NodeClass)
  second := nodeID(source, "Second", NodeClass)
  wire, err := WireNodeIDs("C:/checkout/app", []string{first, second})
  if err != nil {
    t.Fatal(err)
  }
  if wire[first] == wire[second] {
    t.Fatalf("wire IDs collide: %q", wire[first])
  }
  expectedSource := "node_modules/pkg/index.d.ts"
  if nodeFile(wire[first]) != expectedSource || nodeFile(wire[second]) != expectedSource {
    t.Fatalf("wire source coordinates = %q and %q, want %q", nodeFile(wire[first]), nodeFile(wire[second]), expectedSource)
  }
}
