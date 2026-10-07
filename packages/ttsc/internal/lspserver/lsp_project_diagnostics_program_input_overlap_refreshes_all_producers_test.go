package lspserver

import (
  "bytes"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPProjectDiagnosticsProgramInputOverlapRefreshesAllProducers verifies a
// declared input that can also belong to the Program widens diagnostic scope.
//
// Only the first supplied snapshot declares each tested path. The direct scope
// policy widens .ts and .json inputs; neither an actual Program nor a filesystem
// edit runs here. Non-Program data scoping is separately exercised by
// lsp_project_diagnostics_refreshes_only_input_owners_test.go.
//
//  1. Declare one shared-Program path for the first producer only.
//  2. Resolve its owner scope and widen it as a watched Program input.
//  3. Assert the scope became all-producer.
//  4. Refresh and assert both producers were invoked.
//
// @evidence contracts/testing.md#behavioral-verification Supplied .ts and .json URIs initially match one retained owner, then the direct watched-input scope policy marks all. A separate explicit nil-owner refresh selects two descriptors, is incomplete and logs both failed producers; this is not an end-to-end scope-to-refresh dispatch or actual Program membership check.
// @evidence contracts/testing.md#independent-expectations One matched owner, all=true, selected=2, complete=false and both descriptor-name errors are literal observations. Checked absent binaries establish the failed native-start premise; expected values are not derived from scope-policy output.
// @evidence contracts/testing.md#distinguishing-cases Only the first producer declares the path, so owner-only scoping would invoke one.
// @evidence contracts/testing.md#execution-ownership Named .ts and .json Go subtests directly seed NativePluginSource snapshots, query Proxy owner scope, widen it and explicitly request an all-owner refresh. Owned native temporary roots supply URI identity, while missing binaries reach failed resident/direct start attempts; no consumer or product host is installed and no Program is constructed.
func TestLSPProjectDiagnosticsProgramInputOverlapRefreshesAllProducers(
  t *testing.T,
) {
  for _, name := range []string{"shared.ts", "shared.json"} {
    t.Run(name, func(t *testing.T) {
      root := t.TempDir()
      first := NativeLSPPluginEntry{
        Binary:             "ttsc-no-such-first-program-sidecar",
        Name:               "@ttsc/first-program",
        ProjectDiagnostics: true,
        ProjectInputs:      true,
      }
      second := NativeLSPPluginEntry{
        Binary:             "ttsc-no-such-second-program-sidecar",
        Name:               "@ttsc/second-program",
        ProjectDiagnostics: true,
        ProjectInputs:      true,
      }
      for _, plugin := range []NativeLSPPluginEntry{first, second} {
        if path, err := exec.LookPath(plugin.Binary); err == nil {
          t.Fatalf("missing-binary premise is false: %s", path)
        }
      }
      var log bytes.Buffer
      source := &NativePluginSource{
        err:     &log,
        plugins: []NativeLSPPluginEntry{first, second},
      }
      input := filepath.Join(root, "src", name)
      source.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
        Root:  filepath.ToSlash(root),
        Files: []string{filepath.ToSlash(input)},
      })
      source.storeProjectInputs(second, 1, LSPProjectInputSnapshot{
        Root: filepath.ToSlash(root),
        Files: []string{
          filepath.ToSlash(filepath.Join(root, "docs", "second.md")),
        },
      })
      uri := testFileURI(input)
      scope, matched := (&Proxy{source: source}).projectInputOwnerScope(uri)
      if !matched || scope.all || len(scope.owners) != 1 {
        t.Fatalf("declared owner scope = %#v, matched %v", scope, matched)
      }
      scope = projectDiagnosticScopeForWatchedInput(uri, scope)
      if !scope.all {
        t.Fatalf("Program input scope remained owner-only: %#v", scope)
      }

      result := source.ProjectDiagnosticsForOwners(nil)

      if result.selected != 2 || result.complete {
        t.Fatalf("all-producer failed refresh = %#v", result)
      }
      if !strings.Contains(log.String(), first.Name) ||
        !strings.Contains(log.String(), second.Name) {
        t.Fatalf("Program input did not invoke both producers:\n%s", log.String())
      }
    })
  }
}
