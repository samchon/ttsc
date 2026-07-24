package lspserver

import (
  "bytes"
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPProjectDiagnosticsRefreshesOnlyInputOwners verifies flattened client
// watch registration does not erase contributor ownership.
//
//  1. Give two diagnostics-capable producers disjoint exact input snapshots.
//  2. Resolve the first input's owner from the merged source.
//  3. Refresh that owner and assert the unrelated producer is never invoked.
func TestLSPProjectDiagnosticsRefreshesOnlyInputOwners(t *testing.T) {
  root := t.TempDir()
  first := NativeLSPPluginEntry{
    Binary:             "ttsc-no-such-first-owner-sidecar",
    Name:               "@ttsc/first",
    ProjectDiagnostics: true,
    ProjectInputs:      true,
  }
  second := NativeLSPPluginEntry{
    Binary:             "ttsc-no-such-second-owner-sidecar",
    Name:               "@ttsc/second",
    ProjectDiagnostics: true,
    ProjectInputs:      true,
  }
  var log bytes.Buffer
  source := &NativePluginSource{
    err:     &log,
    plugins: []NativeLSPPluginEntry{first, second},
  }
  firstInput := filepath.Join(root, "docs", "first.md")
  source.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(root),
    Files: []string{filepath.ToSlash(firstInput)},
  })
  source.storeProjectInputs(second, 1, LSPProjectInputSnapshot{
    Root: filepath.ToSlash(root),
    Files: []string{
      filepath.ToSlash(filepath.Join(root, "docs", "second.md")),
    },
  })
  owners := source.ProjectInputOwnersForURI(testFileURI(firstInput))
  if len(owners) != 1 || owners[0] != pluginKey(first) {
    t.Fatalf("first input owners = %#v", owners)
  }

  result := source.ProjectDiagnosticsForOwners(owners)

  if result.selected != 1 || result.complete {
    t.Fatalf("scoped failed refresh = %#v", result)
  }
  if !strings.Contains(log.String(), first.Name) {
    t.Fatalf("owned producer was not invoked:\n%s", log.String())
  }
  if strings.Contains(log.String(), second.Name) {
    t.Fatalf("unrelated producer was invoked:\n%s", log.String())
  }
}

// TestLSPProjectDiagnosticsProgramInputOverlapRefreshesAllProducers verifies a
// declared input that can also belong to the Program widens diagnostic scope.
//
// Only the first producer declares the path, but both project-rule producers
// observe the shared Program. TypeScript and resolveJsonModule JSON edits must
// therefore refresh both while the Markdown case above remains owner-scoped.
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
