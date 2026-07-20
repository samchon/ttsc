package main

import "testing"

// TestCheckShimDirCoverageIncludesAstnav keeps astnav's partial linkname bridge
// inside the audit's explicit coverage model without claiming a full re-export.
//
//  1. Assert astnav is deliberately classified as a partial bridge.
//  2. Scan the repository shim root with the same coverage gate as the CLI.
//  3. Confirm its one linkname target remains visible to reachability scanning.
func TestCheckShimDirCoverageIncludesAstnav(t *testing.T) {
  if got := linknameShimDirs["astnav"]; got != "astnav" {
    t.Fatalf("linknameShimDirs[astnav] = %q, want astnav", got)
  }
  if err := checkShimDirCoverage("../../shim"); err != nil {
    t.Fatal(err)
  }
  reachable, err := scanShimReachable("../../shim")
  if err != nil {
    t.Fatal(err)
  }
  if !reachable.has("astnav", "GetTouchingToken") {
    t.Fatal("astnav.GetTouchingToken is not reachable")
  }
}
