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
// @evidence contracts/testing.md#behavioral-verification Actual NewDump with an empty test-owned Graph and one cross-drive provenance config must return the literal root-error fragment. No graph node causes this failure; the returned Dump and JSON bytes are not examined.
// @evidence contracts/testing.md#independent-expectations Authored C:/checkout/app and D:/shared/tsconfig.json have different drive roots, so the expected error contains different filesystem roots. The config digest is supplied inert data, not independently computed file identity or provenance authentication.
// @evidence contracts/testing.md#distinguishing-cases Empty graph facts contrast a provenance-only cross-drive config, exercising error detection after fact projection. TestDumpCheckoutPathsAreStable owns valid same-root provenance coordinates; other provenance fields and native volume aliases are not exercised here.
// @evidence contracts/testing.md#execution-ownership This same-package Go unit directly invokes NewDump with test-owned graph/provenance values. Host-compatible authored absolute paths can trigger best-effort native canonicalization and ancestor reads; no fixture files, compiler Program, serialization, installed consumer or product process are created.
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
