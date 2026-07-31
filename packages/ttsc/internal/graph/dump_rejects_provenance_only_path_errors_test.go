package graph

import (
  "strings"
  "testing"
)

// TestNewDumpRejectsProvenanceOnlyPathErrors verifies paths introduced after
// fact projection still pass through the dump context's fail-closed boundary.
//
// Provenance inputs are mapped after graph facts. Without a final path-error
// check, a cross-drive config could survive into otherwise valid JSON.
//
//  1. Build an empty graph under one synthetic Windows drive.
//  2. Add a provenance-only config input from another drive.
//  3. Require NewDump to reject the unrepresentable coordinate.
func TestNewDumpRejectsProvenanceOnlyPathErrors(t *testing.T) {
  _, err := NewDump(
    &Graph{Nodes: map[string]*Node{}},
    "C:/checkout/app",
    "tsconfig.json",
    nil,
    nil,
    DumpOrigin{Provenance: Provenance{Universe: Universe{Configs: []FileDigest{{
      File:   "D:/shared/tsconfig.json",
      Digest: "config-digest",
    }}}}},
  )
  if err == nil || !strings.Contains(err.Error(), "different filesystem roots") {
    t.Fatalf("provenance-only cross-root error = %v, want rejection before serialization", err)
  }
}
