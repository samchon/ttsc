package lspserver

import (
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
  if len(owners) != 1 || owners[0] != pluginKey(aggregate) {
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
