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
//
// @evidence contracts/testing.md#behavioral-verification Verifies paths introduced after fact projection still pass through the dump context's fail-closed boundary.
// @evidence contracts/testing.md#independent-expectations The explicit input facts and supported graph/command contract establish NewDump to reject the unrepresentable coordinate.
// @evidence contracts/testing.md#distinguishing-cases Build an empty graph under one synthetic Windows drive; Add a provenance-only config input from another drive; Require NewDump to reject the unrepresentable coordinate.
// @evidence contracts/testing.md#execution-ownership TestNewDumpRejectsProvenanceOnlyPathErrors is a Go source-unit entry. NewDump execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
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
