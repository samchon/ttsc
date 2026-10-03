package lspserver

import (
  "os/exec"
  "path/filepath"
  "testing"
)

// TestLSPSameTransportEntriesAreDeduplicated verifies logical manifest entries
// sharing one effective native launch identity produce one aggregate result.
//
// Native verbs receive the full plugin manifest and no selected-entry key. A
// composed aggregate and leaf can therefore have distinct names while invoking
// the same binary with the same argv; treating them as separate producers would
// duplicate diagnostics, inputs, completion hints, and command discovery.
//
// @evidence contracts/testing.md#behavioral-verification Two supplied entries with one binary and different names select the first representative, yield one literal input-owner key, aggregate one stored diagnostic and select one failed project-diagnostics query. Completion hints, command discovery, actual child argv and successful native output are not observed.
// @evidence contracts/testing.md#independent-expectations Literal counts one, the first supplied name and an independently authored owner key establish deduplication. Diagnostic aggregation asserts count only, not every field. The missing shared binary is explicitly checked before failed native starts.
// @evidence contracts/testing.md#distinguishing-cases Identical binary and effective context mode under different names are exercised across selection, stored input ownership, stored diagnostics and failed-query selection. Distinct binaries/context modes are outside this case.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls transport selection and actual NativePluginSource stores, owner matching, snapshot aggregation and refresh. An owned temporary root supplies native path identity; the refresh reaches failed resident/direct starts under the checked missing-binary premise. It installs no consumer or running host and substitutes no operation.
func TestLSPSameTransportEntriesAreDeduplicated(t *testing.T) {
  aggregate := NativeLSPPluginEntry{
    Binary:             "shared-sidecar",
    Name:               "@ttsc/aggregate",
    ProjectDiagnostics: true,
    ProjectInputs:      true,
    Stage:              "check",
  }
  leaf := aggregate
  leaf.Name = "@ttsc/leaf"
  if path, err := exec.LookPath(aggregate.Binary); err == nil {
    t.Fatalf("missing-binary premise is false: %s", path)
  }

  selected := selectPluginTransports(
    []NativeLSPPluginEntry{aggregate, leaf},
    nil,
  )
  if len(selected) != 1 || selected[0].Name != aggregate.Name {
    t.Fatalf("same launch transport selection = %#v", selected)
  }

  root := t.TempDir()
  snapshot := LSPProjectInputSnapshot{
    Root:  root,
    Files: []string{filepath.Join(root, "spec.md")},
  }
  source := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{aggregate, leaf},
  }
  source.storeProjectInputs(aggregate, 1, snapshot)
  source.storeProjectInputs(leaf, 1, snapshot)
  owners := source.ProjectInputOwnersForURI(testFileURI(snapshot.Files[0]))
  if len(owners) != 1 || owners[0] != "shared-sidecar\x000" {
    t.Fatalf("same transport input owners = %#v", owners)
  }

  publication := &LSPProjectDiagnostics{
    URI: "file:///tsconfig.json",
    Diagnostics: []LSPDiagnostic{
      {Message: "one aggregate finding"},
    },
  }
  source.storeProjectDiagnostics(aggregate, 1, publication)
  source.storeProjectDiagnostics(leaf, 1, publication)
  merged := source.projectDiagnosticsSnapshot()
  if merged == nil || len(merged.Diagnostics) != 1 {
    t.Fatalf("same transport project publication = %#v", merged)
  }

  result := source.ProjectDiagnosticsForOwners(nil)
  if result.selected != 1 {
    t.Fatalf("same transport selected %d project producers", result.selected)
  }
}
